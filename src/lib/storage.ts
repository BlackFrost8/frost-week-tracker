import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  type Firestore,
} from 'firebase/firestore/lite';
import type { StorageKind, Week } from '../types';
import { mergeWeeks, normalizeWeek, uid as newId } from './week';
import { migrateAnonPrefs } from './prefs';
import { auth, db } from './firebase';

/**
 * Everything the app needs from persistence. Two implementations satisfy it —
 * localStorage and Firestore — and the UI never knows which one it's talking to.
 */
export interface WeekStore {
  readonly kind: StorageKind;
  /** ISO Monday dates of every stored week, newest first. */
  listWeekStarts(): Promise<string[]>;
  loadWeek(weekStart: string): Promise<Week | null>;
  saveWeek(week: Week): Promise<void>;
  deleteWeek(weekStart: string): Promise<void>;
}

/* ── Keyed blobs ───────────────────────────────────────────────────────────
   Signed-out work lives under ANON_KEY. Signed-in work is mirrored under a
   uid-scoped key, which is what keeps one account's tasks off the screen when
   a different person signs in on the same school Chromebook. */

const ANON_KEY = 'frost-week-tracker:v1';
const mirrorKey = (uid: string) => `frost-week-tracker:mirror:${uid}`;
const metaKey = (base: string) => `${base}:meta`;

type WeekShape = Record<string, Week>;

/**
 * When each week was last written here, whether the cloud has it yet, and
 * which cloud revision the local copy was built on.
 *
 * `rev` is what decides a sync, not `updatedAt`. Timestamps come from each
 * device's own clock, and a school Chromebook running five minutes fast used
 * to win against newer work from a correctly set PC. A revision is a random id
 * the writer stamps on the cloud document: if the cloud still carries the one
 * this device last saw, nobody else has written since, whatever any clock says.
 * `updatedAt` survives as the identity of one local snapshot, and as the
 * tie-break for documents written before revisions existed.
 */
type Meta = { updatedAt: string; dirty: boolean; rev?: string };
type MetaShape = Record<string, Meta>;

function readJSON<T extends object>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, data: object): void {
  localStorage.setItem(key, JSON.stringify(data));
}

const readWeeks = (base: string) => readJSON<WeekShape>(base, {});
const readMeta = (base: string) => readJSON<MetaShape>(metaKey(base), {});

/** The one write that cannot fail. Everything else is a mirror of this. */
function putLocal(base: string, week: Week, dirty: boolean): string {
  const weeks = readWeeks(base);
  weeks[week.weekStart] = week;
  writeJSON(base, weeks);

  const meta = readMeta(base);
  const updatedAt = new Date().toISOString();
  // The revision is kept: an edit is still built on whatever the cloud last held.
  meta[week.weekStart] = withRev({ updatedAt, dirty }, meta[week.weekStart]?.rev);
  writeJSON(metaKey(base), meta);
  return updatedAt;
}

/** `rev` left off rather than undefined, so the JSON stays tidy. */
function withRev(meta: Meta, rev: string | undefined): Meta {
  return rev ? { ...meta, rev } : meta;
}

/** Unconditional. For the one case that genuinely replaces the local copy. */
function writeMeta(
  base: string,
  weekStart: string,
  updatedAt: string,
  dirty: boolean,
  rev: string | undefined,
): void {
  const meta = readMeta(base);
  meta[weekStart] = withRev({ updatedAt, dirty }, rev);
  writeJSON(metaKey(base), meta);
}

/**
 * Clears the dirty flag only if the edit that just reached the cloud is still
 * the newest one on the device.
 *
 * A push reports success for the snapshot *it* sent. If a newer edit was saved
 * while that request was in the air, clearing the flag unconditionally marks
 * the newer edit as safely uploaded when it never left — `flushPending` then
 * has nothing to retry, and the next load lets the cloud overwrite it. The
 * timestamp is the identity of the snapshot, so an exact match is the only
 * safe case to clear on.
 */
function markClean(base: string, weekStart: string, updatedAt: string, rev: string): void {
  const current = readMeta(base)[weekStart];
  if (current && current.updatedAt !== updatedAt) {
    /* Still dirty — but the cloud now holds this device's own write, and the
       newer edit was made on top of it. Recording the revision is what lets
       that edit win its own sync later instead of reading as a conflict. */
    writeMeta(base, weekStart, current.updatedAt, current.dirty, rev);
    return;
  }
  writeMeta(base, weekStart, updatedAt, false, rev);
}

function dropLocal(base: string, weekStart: string): void {
  const weeks = readWeeks(base);
  delete weeks[weekStart];
  writeJSON(base, weeks);

  const meta = readMeta(base);
  delete meta[weekStart];
  writeJSON(metaKey(base), meta);
}

/**
 * Takes the cloud copy as authoritative for this week and records it as clean.
 *
 * Shared by the two places that reach that conclusion — `loadWeek` and
 * `flushPending` — so the "cloud wins" branch cannot drift into two subtly
 * different behaviours. The flag is written outright rather than through the
 * guarded `markClean`: both callers establish first that there is no local
 * edit left worth protecting.
 */
function adoptCloud(base: string, weekStart: string, cloudRaw: CloudDoc): Week {
  const week = normalizeWeek(cloudRaw, weekStart);
  const weeks = readWeeks(base);
  weeks[weekStart] = week;
  writeJSON(base, weeks);
  writeMeta(base, weekStart, cloudRaw.updatedAt || new Date().toISOString(), false, cloudRaw.rev);
  return week;
}

/**
 * What a dirty local copy becomes when the cloud also has the week.
 *
 * - The cloud still carries the revision this device last saw: nobody else
 *   has written since, so the local edit simply goes up.
 * - Anything else means another device wrote while this one's edit was stuck
 *   on the device. Both are kept — the local copy's own edits, plus whatever
 *   only the cloud copy has — rather than one being thrown away. Picking a
 *   winner by timestamp is what used to lose work, and it trusted two clocks
 *   that need not agree.
 *
 * Documents written before revisions existed carry none, and nor does any
 * local meta; for exactly that pair the old timestamp rule still applies, so
 * an upgrade doesn't turn every pending edit into a merge.
 */
function resolveDirty(local: Week, meta: Meta, cloudRaw: CloudDoc): Week {
  if (cloudRaw.rev !== undefined && cloudRaw.rev === meta.rev) return local;
  if (cloudRaw.rev === undefined && meta.rev === undefined) {
    if (meta.updatedAt > (cloudRaw.updatedAt ?? '')) return local;
  }
  return mergeWeeks(local, normalizeWeek(cloudRaw, local.weekStart));
}

/* ── Local ─────────────────────────────────────────────────────────────── */

export const localStore: WeekStore = {
  kind: 'local',

  async listWeekStarts() {
    return Object.keys(readWeeks(ANON_KEY)).sort().reverse();
  },

  async loadWeek(weekStart) {
    const raw = readWeeks(ANON_KEY)[weekStart];
    return raw ? normalizeWeek(raw, weekStart) : null;
  },

  async saveWeek(week) {
    putLocal(ANON_KEY, week, false);
  },

  async deleteWeek(weekStart) {
    dropLocal(ANON_KEY, weekStart);
  },
};

/* ── Cloud ─────────────────────────────────────────────────────────────────
   One document per week at `users/{uid}/weeks/{weekStart}`. The week start is
   the document id, which makes `listWeekStarts` a pure id read with no query
   or index, and makes every write an idempotent overwrite of one document.

   `Week.days` is an array of day objects that each contain a `tasks` array.
   Firestore forbids an array directly inside an array, but an array of maps
   that each hold an array is fine — so the existing type serialises as-is.

   LOCAL-FIRST. Every save hits localStorage synchronously before it touches
   the network, so a failed request is a sync delay, never lost work. Signing
   in used to turn a save that could not fail into a bare network call whose
   entire failure handling was one word in the header. A week that could not
   reach Firestore stays flagged `dirty` and is retried by `flushPending()`
   the next time the tab is looked at. */

function requireDb(): Firestore {
  if (!db) throw new Error('Cloud sync is not configured.');
  return db;
}

function requireUid(): string {
  const uid = auth?.currentUser?.uid;
  if (!uid) throw new Error('Not signed in.');
  return uid;
}

function weeksCol(database: Firestore, uid: string) {
  return collection(database, 'users', uid, 'weeks');
}

type CloudDoc = Week & { updatedAt?: string; rev?: string };

/**
 * One in-flight cloud write per week document, queued in issue order.
 *
 * `firestore/lite` keeps no local mutation queue — each `setDoc` is a bare
 * HTTP request — so two saves of the same week can land in either order and
 * the slower, older one wins. Ticking two boxes four hundred milliseconds
 * apart on a slow connection is enough: the second tick reaches the server
 * first, the first tick lands after it, and the cloud ends up without the
 * second tick while the screen still shows it.
 *
 * Keyed per week rather than globally so editing this week never waits on a
 * retry of some week from March.
 */
const writeChains = new Map<string, Promise<unknown>>();

function queueWrite(key: string, run: () => Promise<void>): Promise<void> {
  const previous = writeChains.get(key) ?? Promise.resolve();
  // The catch is load-bearing: without it one failed write parks a rejected
  // promise at the head of the chain and every later write is dropped.
  const next = previous.catch(() => {}).then(run);
  writeChains.set(key, next);

  // Shed finished chains, but only if nothing queued behind this one.
  void next
    .catch(() => {})
    .then(() => {
      if (writeChains.get(key) === next) writeChains.delete(key);
    });

  return next;
}

async function pushWeek(uid: string, week: Week, updatedAt: string): Promise<void> {
  return queueWrite(`${uid}:${week.weekStart}`, async () => {
    const rev = newId();
    await setDoc(doc(weeksCol(requireDb(), uid), week.weekStart), {
      weekStart: week.weekStart,
      focus: week.focus,
      reward: week.reward,
      affirmation: week.affirmation,
      days: week.days,
      updatedAt,
      rev,
    });
    markClean(mirrorKey(uid), week.weekStart, updatedAt, rev);
  });
}

export const cloudStore: WeekStore = {
  kind: 'cloud',

  async listWeekStarts() {
    const uid = requireUid();
    const local = Object.keys(readWeeks(mirrorKey(uid)));
    try {
      const snap = await getDocs(weeksCol(requireDb(), uid));
      const merged = new Set([...local, ...snap.docs.map((d) => d.id)]);
      return [...merged].sort().reverse();
    } catch {
      // Offline: the mirror still knows every week you've opened on this device.
      return local.sort().reverse();
    }
  },

  async loadWeek(weekStart) {
    const uid = requireUid();
    const base = mirrorKey(uid);

    let cloudRaw: CloudDoc | null = null;
    try {
      const snap = await getDoc(doc(weeksCol(requireDb(), uid), weekStart));
      cloudRaw = snap.exists() ? (snap.data() as CloudDoc) : null;
    } catch (e) {
      // Network down. Serving the mirror is strictly better than an error
      // screen; the header's sync state is what reports the connection.
      const offlineRaw = readWeeks(base)[weekStart];
      if (offlineRaw) return normalizeWeek(offlineRaw, weekStart);
      throw e;
    }

    /* Read the local side AFTER the round trip, never before it.
       The whole job below is to decide whether the device or the cloud holds
       the newer copy, and a snapshot taken before the await is stale by
       however long the network took — a second on a school connection. An
       edit made during that window is precisely the case this decision must
       not get wrong, and reading it early got it wrong in the most visible
       way possible: tick a box as the tab regains focus, and the cloud's
       older copy wins and the box un-ticks itself under the cursor. */
    const localRaw = readWeeks(base)[weekStart];
    const localMeta = readMeta(base)[weekStart];

    // Only on this device: push it up, then use it.
    if (!cloudRaw) {
      if (!localRaw) return null;
      const week = normalizeWeek(localRaw, weekStart);
      try {
        await pushWeek(uid, week, localMeta?.updatedAt ?? new Date().toISOString());
      } catch {
        /* Stays dirty; flushPending will retry. */
      }
      return week;
    }

    // Both sides have it. An unsynced local edit is never discarded: it goes
    // up as it is, or merged with what another device wrote meanwhile (see
    // `resolveDirty`). Otherwise the cloud is truth, because it is the only
    // copy another device could have written.
    if (localRaw && localMeta?.dirty) {
      const local = normalizeWeek(localRaw, weekStart);
      const week = resolveDirty(local, localMeta, cloudRaw);
      // A merge is a new edit, and it gets a fresh local stamp like any other.
      const stamp = week === local ? localMeta.updatedAt : putLocal(base, week, true);
      try {
        await pushWeek(uid, week, stamp);
      } catch {
        /* Stays dirty. */
      }
      return week;
    }

    // Adopting the cloud copy wholesale — there is no local edit left to
    // protect at this point, the line above just established that.
    return adoptCloud(base, weekStart, cloudRaw);
  },

  async saveWeek(week) {
    const uid = requireUid();
    // 1. Local, synchronous, cannot fail.
    const updatedAt = putLocal(mirrorKey(uid), week, true);
    // 2. Cloud. If this throws, the week is already safe and still flagged.
    await pushWeek(uid, week, updatedAt);
  },

  async deleteWeek(weekStart) {
    const uid = requireUid();
    dropLocal(mirrorKey(uid), weekStart);
    await deleteDoc(doc(weeksCol(requireDb(), uid), weekStart));
  },
};

/**
 * Retry every week that failed to reach the cloud. Cheap and safe to call on
 * any focus/visibility change: with nothing dirty it does no work at all.
 * Returns the number of weeks successfully pushed.
 */
export async function flushPending(): Promise<number> {
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) return 0;

  const base = mirrorKey(uid);
  const stale = Object.keys(readMeta(base)).filter((ws) => readMeta(base)[ws]?.dirty);
  if (stale.length === 0) return 0;

  let pushed = 0;
  for (const weekStart of stale) {
    /* Ask what the cloud holds before assuming this device is ahead.
       This used to push every dirty week unconditionally, and it runs on every
       focus ahead of the reload — so the one function that never compared got
       the last word over the one that does. Edit a week on the laptop while
       its connection is down, edit the same week on the phone, then bring the
       laptop back: the laptop uploaded its older copy over the phone's work,
       `markClean` cleared the flag, and the reload pulled the overwrite down
       onto every device. Nothing reported an error, because nothing failed. */
    let cloudRaw: CloudDoc | null;
    try {
      const snap = await getDoc(doc(weeksCol(requireDb(), uid), weekStart));
      cloudRaw = snap.exists() ? (snap.data() as CloudDoc) : null;
    } catch {
      break; // Still offline — leave the rest for the next attempt.
    }

    /* Re-read per iteration and AFTER the round trip, never once before the
       loop. Each await above is time the user spends typing — a snapshot taken
       up front would upload the pre-edit body and then stamp the newer edit as
       clean, which loses it twice over. */
    const raw = readWeeks(base)[weekStart];
    const entry = readMeta(base)[weekStart];
    if (!raw || !entry?.dirty) continue;

    /* The same rule `loadWeek` applies. If another device wrote while this
       edit was stuck here, the two are merged rather than one overwriting the
       other — this used to adopt the cloud copy and drop the local edit, or
       the reverse, depending on which device's clock ran ahead. */
    const local = normalizeWeek(raw, weekStart);
    let toPush = local;
    let stamp = entry.updatedAt;
    if (cloudRaw) {
      toPush = resolveDirty(local, entry, cloudRaw);
      if (toPush !== local) stamp = putLocal(base, toPush, true);
    }

    try {
      await pushWeek(uid, toPush, stamp);
      pushed += 1;
    } catch {
      break; // Still offline — leave the rest for the next attempt.
    }
  }
  return pushed;
}

/** True when this account has work on this device that the cloud hasn't taken. */
export function hasPendingWrites(): boolean {
  const uid = auth?.currentUser?.uid;
  if (!uid) return false;
  const meta = readMeta(mirrorKey(uid));
  return Object.values(meta).some((m) => m?.dirty);
}

/* ── Migration ─────────────────────────────────────────────────────────────
   The first time an account signs in on a device, anything built up while
   signed out is pushed into it — weeks here, and groups, routine and goals
   through `migrateAnonPrefs`. A week that already exists in the account keeps
   everything the account has, and gains whatever was only written signed out:
   nothing another device wrote is overwritten, and nothing typed here is lost. */

/** Keyed per account: signing a second Google account in on the same browser
    used to silently skip its migration, because the flag was global. */
const migratedFlag = (uid: string) => `frost-week-tracker:migrated:${uid}`;

/**
 * Forgets the signed-out blob entirely.
 *
 * `ANON_KEY` is one shared bucket with no owner, and migration used to read it
 * without ever emptying it. On the school Chromebook that is the whole bug:
 * whoever used the app signed out left their weeks sitting there, and the next
 * person to sign in — a different person, a different account — had that work
 * copied into their account permanently, because the migration flag is per-uid
 * and so re-fires for every new account on the device.
 *
 * Called once the weeks are safely in an account, which is the moment the
 * shared copy stops being the only copy and starts being a leak.
 */
function clearAnonWork(): void {
  localStorage.removeItem(ANON_KEY);
  localStorage.removeItem(metaKey(ANON_KEY));
}

export async function migrateLocalToCloud(): Promise<number> {
  const uid = requireUid();
  const flag = migratedFlag(uid);
  if (localStorage.getItem(flag) === 'yes') return 0;

  const localWeeks = readWeeks(ANON_KEY);
  const weekStarts = Object.keys(localWeeks);
  if (weekStarts.length === 0) {
    // Groups, a routine and goals can exist with no week yet written.
    await migrateAnonPrefs();
    clearAnonWork();
    localStorage.setItem(flag, 'yes');
    return 0;
  }

  const existing = new Set(await cloudStore.listWeekStarts());
  let uploaded = 0;

  for (const weekStart of weekStarts) {
    const week = normalizeWeek(localWeeks[weekStart], weekStart);
    // An empty shell week isn't worth uploading.
    const hasContent =
      week.focus ||
      week.reward ||
      week.affirmation ||
      week.days.some((d) => d.tasks.some((t) => t.label.trim() !== ''));
    if (!hasContent) continue;

    if (existing.has(weekStart)) {
      /* The account already has this week — written on another device. It
         used to be skipped here, and the anon blob cleared below, so every
         task typed signed-out that week was destroyed without a word. The
         account's copy leads; the signed-out tasks are added to it. */
      const current = await cloudStore.loadWeek(weekStart);
      const merged = current ? mergeWeeks(current, week) : week;
      if (merged === current) continue;
      await cloudStore.saveWeek(merged);
      uploaded += 1;
      continue;
    }

    await cloudStore.saveWeek(week);
    uploaded += 1;
  }

  /* Prefs before the anon work is cleared: the weeks just moved point at the
     signed-out groups by id, and without those groups every mark is lost. */
  await migrateAnonPrefs();

  /* Only reached if every `saveWeek` above resolved — one throw propagates out
     of here, App leaves the flag unset, and the next sign-in retries against
     an anon blob that is still intact. So arriving here means the work is in
     the account and the shared copy is now purely a leak. */
  clearAnonWork();
  localStorage.setItem(flag, 'yes');
  return uploaded;
}

/**
 * Drops this account's cached weeks from the device. The cloud copy is
 * untouched; this only forgets what is mirrored locally.
 *
 * Refuses while anything is still un-uploaded, and reports it, because the
 * mirror is the only copy of that work — clearing it to tidy up after a
 * sign-out would destroy exactly the edits the dirty flag exists to protect.
 * The caller flushes first and can tell the user when it could not.
 */
export function clearAccountCache(uid: string): boolean {
  const base = mirrorKey(uid);
  if (Object.values(readMeta(base)).some((m) => m?.dirty)) return false;
  localStorage.removeItem(base);
  localStorage.removeItem(metaKey(base));
  return true;
}

/**
 * Forgets this account on this device completely, dirty or not — for after
 * the account has been deleted, when there is no cloud left to protect the
 * unsent edits for. `clearAccountCache` is the cautious version for sign-out.
 */
export function forgetAccountOnDevice(uid: string): void {
  const base = mirrorKey(uid);
  localStorage.removeItem(base);
  localStorage.removeItem(metaKey(base));
  localStorage.removeItem(migratedFlag(uid));
}
