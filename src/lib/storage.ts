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
import { normalizeWeek } from './week';
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

/** When each week was last written here, and whether the cloud has it yet. */
type Meta = { updatedAt: string; dirty: boolean };
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
  meta[week.weekStart] = { updatedAt, dirty };
  writeJSON(metaKey(base), meta);
  return updatedAt;
}

/** Unconditional. For the one case that genuinely replaces the local copy. */
function writeMeta(base: string, weekStart: string, updatedAt: string, dirty: boolean): void {
  const meta = readMeta(base);
  meta[weekStart] = { updatedAt, dirty };
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
function markClean(base: string, weekStart: string, updatedAt: string): void {
  const current = readMeta(base)[weekStart];
  if (current && current.updatedAt !== updatedAt) return;
  writeMeta(base, weekStart, updatedAt, false);
}

function dropLocal(base: string, weekStart: string): void {
  const weeks = readWeeks(base);
  delete weeks[weekStart];
  writeJSON(base, weeks);

  const meta = readMeta(base);
  delete meta[weekStart];
  writeJSON(metaKey(base), meta);
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

type CloudDoc = Week & { updatedAt?: string };

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
    await setDoc(doc(weeksCol(requireDb(), uid), week.weekStart), {
      weekStart: week.weekStart,
      focus: week.focus,
      reward: week.reward,
      affirmation: week.affirmation,
      days: week.days,
      updatedAt,
    });
    markClean(mirrorKey(uid), week.weekStart, updatedAt);
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

    // Both sides have it. An unsynced local edit that is newer than the cloud
    // copy is the one case where local wins — otherwise the cloud is truth,
    // because it is the only copy another device could have written.
    const cloudAt = cloudRaw.updatedAt ?? '';
    if (localRaw && localMeta?.dirty && localMeta.updatedAt > cloudAt) {
      const week = normalizeWeek(localRaw, weekStart);
      try {
        await pushWeek(uid, week, localMeta.updatedAt);
      } catch {
        /* Stays dirty. */
      }
      return week;
    }

    // Adopting the cloud copy wholesale, so the flag is set outright rather
    // than through the guarded `markClean` — there is no local edit left to
    // protect at this point, the line above just established that.
    const week = normalizeWeek(cloudRaw, weekStart);
    const weeks = readWeeks(base);
    weeks[weekStart] = week;
    writeJSON(base, weeks);
    writeMeta(base, weekStart, cloudAt || new Date().toISOString(), false);
    return week;
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
    /* Re-read per iteration, not once before the loop. Each push below is an
       await, and the user is still typing during it — a snapshot taken up
       front would upload the pre-edit body and then stamp the newer edit as
       clean, which loses it twice over. */
    const raw = readWeeks(base)[weekStart];
    const entry = readMeta(base)[weekStart];
    if (!raw || !entry?.dirty) continue;
    try {
      await pushWeek(uid, normalizeWeek(raw, weekStart), entry.updatedAt);
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
   signed out is pushed into it. A week that already exists in the account is
   left alone — the account is the source of truth once it exists, and we
   never overwrite something another device wrote. */

/** Keyed per account: signing a second Google account in on the same browser
    used to silently skip its migration, because the flag was global. */
const migratedFlag = (uid: string) => `frost-week-tracker:migrated:${uid}`;

export async function migrateLocalToCloud(): Promise<number> {
  const uid = requireUid();
  const flag = migratedFlag(uid);
  if (localStorage.getItem(flag) === 'yes') return 0;

  const localWeeks = readWeeks(ANON_KEY);
  const weekStarts = Object.keys(localWeeks);
  if (weekStarts.length === 0) {
    localStorage.setItem(flag, 'yes');
    return 0;
  }

  const existing = new Set(await cloudStore.listWeekStarts());
  let uploaded = 0;

  for (const weekStart of weekStarts) {
    if (existing.has(weekStart)) continue;
    const week = normalizeWeek(localWeeks[weekStart], weekStart);
    // An empty shell week isn't worth uploading.
    const hasContent =
      week.focus ||
      week.reward ||
      week.affirmation ||
      week.days.some((d) => d.tasks.some((t) => t.label.trim() !== ''));
    if (!hasContent) continue;

    await cloudStore.saveWeek(week);
    uploaded += 1;
  }

  localStorage.setItem(flag, 'yes');
  return uploaded;
}
