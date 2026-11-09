import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import type { DayId } from '../types';
import { auth, db } from './firebase';
import { DEFAULT_ICON, isKnownIcon, type IconId } from './icons';
import { DAY_IDS, uid as newId } from './week';

/**
 * Account preferences, as opposed to device preferences.
 *
 * The theme lives in `theme.ts` and stays on the device, because it's about
 * the screen in front of you. This is the other kind: your standing tasks are
 * *content*, so they follow the account the same way weeks do — otherwise
 * setting them up on the PC would leave the Chromebook still typing them out
 * by hand, which is the whole complaint this feature answers.
 */

/**
 * One line of your routine, plus the days it actually belongs to.
 *
 * `days` exists because a routine is rarely seven-sevenths uniform: the gym is
 * Monday/Wednesday/Friday and the long run is Sunday. Seeding those into all
 * seven days and deleting five by hand every week is the same retyping problem
 * standing tasks were meant to end.
 */
export type StandingTask = {
  label: string;
  /** Days this task is seeded into. Empty means it is parked, not deleted. */
  days: DayId[];
  /** Carried onto every task this seeds, so a routine keeps its group. */
  groupId: string | null;
};

/** A calendar note that repeats on the days listed. Empty days means parked. */
export type StandingNote = {
  label: string;
  days: DayId[];
};

/** Applies to standing tasks and standing notes, each list on its own. */
export const MAX_STANDING = 20;

/**
 * A named bucket a task can belong to — School, Health, whatever the week is
 * actually made of.
 *
 * Account-level rather than per-week, and deliberately so: a group is a fact
 * about how you sort your life, not about one seven-day window, and putting it
 * in the week document would mean February's "School" and March's "School"
 * were two unrelated things that happened to share a name.
 *
 * A group is a name and a shape, and no colour. Every hue in this app is
 * derived from the user's two theme colours at runtime, so a stored per-group
 * colour would be the one thing a theme change could not reach — see
 * `components/TaskIcon.tsx`.
 */
export type TaskGroup = {
  id: string;
  name: string;
  /** An id from `lib/icons`. Unknown ids fall back rather than failing. */
  icon: IconId;
  /**
   * Whether this group also reports what is filed under it in later weeks.
   *
   * Off by default, because most groups are a way of sorting the seven days in
   * front of you and a list that reached past them would be noise. It is on
   * for the groups that hold work with a deadline — a test three weeks out is
   * not something you want to rediscover on the Monday it lands.
   *
   * It changes what a group *shows*, never what it contains: nothing is copied
   * forward and no task moves. The task stays on the day it was written on.
   */
  carryAcross: boolean;
};

/** Past a dozen, a list you scan to find things becomes a thing to scan. */
export const MAX_GROUPS = 12;
export const MAX_GROUP_NAME = 20;

/**
 * Something you are working toward over months, not days.
 *
 * Account-level for the same reason a group is: a goal that reset every Monday
 * would just be a task with a longer name. It carries no dates and no progress
 * of its own — the week below it is the progress.
 */
export type LongTermGoal = {
  id: string;
  label: string;
  done: boolean;
};

/** Enough to hold a life's directions; few enough to still be a short list. */
export const MAX_GOALS = 10;
export const MAX_GOAL_LABEL = 70;

export type Prefs = {
  /** Seeded into each matching day of a newly created week, in this order. */
  defaultTasks: StandingTask[];
  /** Seeded into each matching day's calendar notes, in this order. */
  defaultNotes: StandingNote[];
  /** In creation order. Tasks reference these by `id`. */
  groups: TaskGroup[];
  /** In the order they were written. Nothing else references these. */
  goals: LongTermGoal[];
  /**
   * A square data URL, or null to fall back to the Google account photo.
   *
   * Kept in the settings document rather than Firebase Storage: a 192px JPEG
   * is ~12KB, three orders of magnitude under the 1MB document ceiling, and it
   * means the picture rides the same read the standing tasks already do
   * instead of needing a second product enabled and a second set of rules.
   */
  avatar: string | null;
  /**
   * Whether this account has been shown the tour.
   *
   * On the account rather than on the device, because a tour is something a
   * person has had rather than something a browser has done: signing in on the
   * school Chromebook after taking it at home should not start it over. The
   * device keeps its own copy as well (`lib/tour.ts`), for the moment before
   * an account exists to ask.
   */
  tourDone: boolean;
};

export const EMPTY_PREFS: Prefs = {
  defaultTasks: [],
  defaultNotes: [],
  groups: [],
  goals: [],
  avatar: null,
  tourDone: false,
};

const everyDay = (): DayId[] => [...DAY_IDS];

/** A fresh group, ready to be named. Ids are opaque and never reused. */
export function makeGroup(name: string, icon: IconId, carryAcross = false): TaskGroup {
  return { id: newId(), name: name.trim().slice(0, MAX_GROUP_NAME), icon, carryAcross };
}

/** A fresh goal. Blank labels are rejected by the caller, not stored. */
export function makeGoal(label: string): LongTermGoal {
  return { id: newId(), label: label.trim().slice(0, MAX_GOAL_LABEL), done: false };
}

/**
 * The group a task points at, or null.
 *
 * Resolving by lookup — rather than cascading a delete through every stored
 * week — is what makes deleting a group cheap and safe. A task left pointing
 * at a group that no longer exists simply reads as ungrouped on every device,
 * including the ones that were offline when it went.
 */
export function groupById(groups: TaskGroup[], id: string | null): TaskGroup | null {
  if (!id) return null;
  return groups.find((g) => g.id === id) ?? null;
}

/* There is deliberately no starter list. A routine you didn't choose is
   someone else's routine, and five tasks you have to delete before you can
   begin are worse than a blank card. An empty day simply says nothing is
   planned yet. */

/**
 * The starter list that used to be written into every new account's prefs.
 *
 * Dropping it from the code was only half the job: an account that signed in
 * even once under the old version has these five saved in its prefs document,
 * so they load back on every sign-in and seed every new week — which is why
 * signing in still produced five tasks nobody chose, long after the seed was
 * removed. `isLegacyStarter` recognises that untouched list and `loadPrefs`
 * clears it, once, for good.
 */
const LEGACY_STARTER = [
  'wake up at 6:00',
  'gym',
  'read 10 pages',
  'drink 2l of water',
  'cook a healthy meal',
];

/**
 * True only for the auto-seeded list exactly as it was written: all five
 * labels, nothing added or renamed, every one still set to all seven days.
 * Change any part of it — delete a line, retype one, narrow "Gym" to
 * Mon/Wed/Fri — and it stops matching, because at that point it is a routine
 * the user has actually chosen and must not be thrown away.
 */
function isLegacyStarter(tasks: StandingTask[]): boolean {
  if (tasks.length !== LEGACY_STARTER.length) return false;
  if (!tasks.every((t) => t.days.length === DAY_IDS.length)) return false;
  const labels = tasks.map((t) => t.label.toLowerCase());
  return LEGACY_STARTER.every((label) => labels.includes(label));
}

/** The prefs as they should be, with the abandoned seed dropped. */
function withoutLegacyStarter(prefs: Prefs): Prefs {
  return isLegacyStarter(prefs.defaultTasks) ? { ...prefs, defaultTasks: [] } : prefs;
}

const ANON_KEY = 'frost-week-tracker:prefs';
const localKey = (uid: string | null) => (uid ? `frost-week-tracker:prefs:${uid}` : ANON_KEY);

/**
 * Standing tasks used to be a bare `string[]`. Anything saved before days
 * existed still arrives in that shape, and it means "every day" — which is
 * exactly what those weeks were already doing.
 */
function toStandingTask(raw: unknown): StandingTask | null {
  if (typeof raw === 'string') {
    const label = raw.trim();
    return label ? { label, days: everyDay(), groupId: null } : null;
  }
  if (typeof raw !== 'object' || raw === null) return null;

  const r = raw as Partial<StandingTask>;
  const label = typeof r.label === 'string' ? r.label.trim() : '';
  if (!label) return null;

  // Filtering DAY_IDS rather than trusting the stored array keeps the order
  // canonical and drops anything that isn't a real day id.
  const days = Array.isArray(r.days)
    ? DAY_IDS.filter((id) => (r.days as unknown[]).includes(id))
    : everyDay();

  // Never `undefined`: this object is written into a Firestore document as-is,
  // and `setDoc` refuses undefined field values outright.
  const groupId = typeof r.groupId === 'string' && r.groupId ? r.groupId : null;

  return { label, days, groupId };
}

/** Rebuilt field by field, so no `groupId` reaches a note. */
function toStandingNote(raw: unknown): StandingNote | null {
  const task = toStandingTask(raw);
  return task && { label: task.label, days: task.days };
}

/** Same contract as `toStandingTask`: trusted shape out, or nothing. */
function toGroup(raw: unknown): TaskGroup | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<TaskGroup>;

  const name = typeof r.name === 'string' ? r.name.trim().slice(0, MAX_GROUP_NAME) : '';
  if (!name) return null;

  // An id is the only thing tasks hold onto, so a document that somehow lost
  // one gets a fresh id rather than being dropped — the group survives, its
  // existing tasks read as ungrouped, which beats losing the group as well.
  const id = typeof r.id === 'string' && r.id ? r.id : newId();

  // `=== true` rather than a cast: every group saved before this existed has
  // no such field, and `undefined` must not reach Firestore.
  return {
    id,
    name,
    icon: isKnownIcon(r.icon) ? r.icon : DEFAULT_ICON,
    carryAcross: r.carryAcross === true,
  };
}

/** Same contract again. `done` is coerced, never left undefined for Firestore. */
function toGoal(raw: unknown): LongTermGoal | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<LongTermGoal>;

  const label = typeof r.label === 'string' ? r.label.trim().slice(0, MAX_GOAL_LABEL) : '';
  if (!label) return null;

  const id = typeof r.id === 'string' && r.id ? r.id : newId();
  return { id, label, done: r.done === true };
}

function normalise(raw: unknown): Prefs {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PREFS;
  const r = raw as Partial<Prefs>;

  const defaultTasks = Array.isArray(r.defaultTasks)
    ? r.defaultTasks
        .map(toStandingTask)
        .filter((t): t is StandingTask => t !== null)
        .slice(0, MAX_STANDING)
    : [];

  const defaultNotes = Array.isArray(r.defaultNotes)
    ? r.defaultNotes
        .map(toStandingNote)
        .filter((n): n is StandingNote => n !== null)
        .slice(0, MAX_STANDING)
    : [];

  /* Deduplicated by id. Two groups sharing one id would make `groupById`
     resolve a task to whichever happened to be first, and the panel would
     render the same tasks under both names. */
  const seen = new Set<string>();
  const groups: TaskGroup[] = [];
  if (Array.isArray(r.groups)) {
    for (const entry of r.groups) {
      if (groups.length >= MAX_GROUPS) break;
      const group = toGroup(entry);
      if (!group || seen.has(group.id)) continue;
      seen.add(group.id);
      groups.push(group);
    }
  }

  /* Deduplicated by id for the same reason groups are, though nothing points
     at a goal: two sharing one id are two React keys that collide. */
  const goalIds = new Set<string>();
  const goals: LongTermGoal[] = [];
  if (Array.isArray(r.goals)) {
    for (const entry of r.goals) {
      if (goals.length >= MAX_GOALS) break;
      const goal = toGoal(entry);
      if (!goal || goalIds.has(goal.id)) continue;
      goalIds.add(goal.id);
      goals.push(goal);
    }
  }

  // Only ever a data URL: a remote URL here would be somewhere else's image
  // loading on every render of the header.
  const avatar =
    typeof r.avatar === 'string' && r.avatar.startsWith('data:image/') ? r.avatar : null;

  // Anything but an explicit `true` reads as not yet shown, which is the right
  // answer for every account written before this field existed.
  return { defaultTasks, defaultNotes, groups, goals, avatar, tourDone: r.tourDone === true };
}

function readLocal(uid: string | null): Prefs {
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? normalise(JSON.parse(raw)) : EMPTY_PREFS;
  } catch {
    return EMPTY_PREFS;
  }
}

function writeLocal(uid: string | null, prefs: Prefs): void {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(prefs));
  } catch {
    /* Quota or private mode — the cloud copy is still authoritative. */
  }
}

const prefsDoc = (uid: string) => doc(db!, 'users', uid, 'settings', 'prefs');

/* ── Sync bookkeeping ──────────────────────────────────────────────────────
   Prefs are six unrelated fields sharing one document, and they are synced
   field by field.

   They used to be written as one whole document from whatever this tab had
   in memory, and re-read only at sign-in. So a PC tab left open since Monday,
   ticking a goal on Thursday, wrote Monday's copy of every field — and the
   group the Chromebook had added on Wednesday was gone, with no error
   anywhere. Each write now carries only the field it changed, merged into the
   document, so editing goals cannot touch groups at all.

   Each field also carries a revision in the document's `stamps` map, and the
   device remembers which revision it last saw (`base`) and which fields hold
   edits the cloud has not acknowledged (`dirty`). Without that, a load simply
   let the cloud win, and edits made while offline were overwritten by the
   older cloud copy on the next reload — the very thing weeks were fixed for. */

export type PrefsField = keyof Prefs;
const FIELDS: PrefsField[] = [
  'defaultTasks',
  'defaultNotes',
  'groups',
  'goals',
  'avatar',
  'tourDone',
];

type Stamps = Partial<Record<PrefsField, string>>;
type PrefsMeta = { dirty: PrefsField[]; base: Stamps };

const metaKey = (uid: string) => `${localKey(uid)}:meta`;

function readStamps(raw: unknown): Stamps {
  const out: Stamps = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const field of FIELDS) {
    const value = (raw as Record<string, unknown>)[field];
    if (typeof value === 'string' && value) out[field] = value;
  }
  return out;
}

function readMeta(uid: string): PrefsMeta {
  try {
    const raw = JSON.parse(localStorage.getItem(metaKey(uid)) ?? 'null') as Partial<PrefsMeta> | null;
    const dirty = Array.isArray(raw?.dirty)
      ? FIELDS.filter((f) => (raw.dirty as unknown[]).includes(f))
      : [];
    return { dirty, base: readStamps(raw?.base) };
  } catch {
    return { dirty: [], base: {} };
  }
}

function writeMeta(uid: string, meta: PrefsMeta): void {
  try {
    localStorage.setItem(metaKey(uid), JSON.stringify(meta));
  } catch {
    /* Private mode: the edit still goes up, it just can't be retried later. */
  }
}

function hasContent(prefs: Prefs): boolean {
  return (
    prefs.defaultTasks.length > 0 ||
    prefs.defaultNotes.length > 0 ||
    prefs.groups.length > 0 ||
    prefs.goals.length > 0 ||
    prefs.avatar !== null ||
    prefs.tourDone
  );
}

/** `primary`'s entries in their order, then whatever only `secondary` has. */
function mergeList<T>(primary: T[], secondary: T[], key: (t: T) => string, cap: number): T[] {
  const have = new Set(primary.map(key));
  const extra = secondary.filter((t) => !have.has(key(t)));
  return extra.length ? [...primary, ...extra].slice(0, cap) : primary;
}

/**
 * Two copies of the prefs, edited apart, made into one.
 *
 * As with weeks there is no common ancestor, so this keeps rather than
 * guesses: `primary`'s version of anything both copies hold, plus anything
 * only `secondary` has. A group deleted on one side can come back; a group
 * made on either side is never lost.
 */
export function mergePrefs(primary: Prefs, secondary: Prefs): Prefs {
  return {
    defaultTasks: mergeList(
      primary.defaultTasks,
      secondary.defaultTasks,
      (t) => t.label.trim().toLowerCase(),
      MAX_STANDING,
    ),
    defaultNotes: mergeList(
      primary.defaultNotes,
      secondary.defaultNotes,
      (n) => n.label.trim().toLowerCase(),
      MAX_STANDING,
    ),
    groups: mergeList(primary.groups, secondary.groups, (g) => g.id, MAX_GROUPS),
    goals: mergeList(primary.goals, secondary.goals, (g) => g.id, MAX_GOALS),
    avatar: primary.avatar ?? secondary.avatar,
    tourDone: primary.tourDone || secondary.tourDone,
  };
}

/** One field copied across, typed so the field and its value always agree. */
function take<K extends PrefsField>(target: Prefs, source: Prefs, field: K): void {
  target[field] = source[field];
}

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * The prefs this device should now hold, given what the cloud just returned
 * (`raw`, or null for no document).
 *
 * Synchronous on purpose, and reading the device copy only here, after the
 * round trip: an edit made while the request was in the air is exactly the
 * one this must not get wrong.
 *
 * Per field: one with no unsent edit takes the cloud's value. One with an
 * unsent edit keeps it — outright when the cloud still carries the revision
 * this device last saw, merged with the cloud's value when another device
 * wrote that field meanwhile — and is sent up again.
 */
function reconcile(uid: string, raw: unknown): Prefs {
  const local = readLocal(uid);
  const meta = readMeta(uid);

  if (raw === null) {
    // First sign-in on this account: adopt whatever this device holds for it,
    // minus the abandoned seed, which must not be carried into the account.
    const cleaned = withoutLegacyStarter(local);
    writeLocal(uid, cleaned);
    if (hasContent(cleaned)) void savePrefs(cleaned, FIELDS).catch(() => {});
    return cleaned;
  }

  const cloud = normalise(raw);
  const stamps = readStamps((raw as Record<string, unknown>).stamps);
  const merged = mergePrefs(local, cloud);
  const result: Prefs = { ...cloud };
  const push: PrefsField[] = [];

  for (const field of FIELDS) {
    if (!meta.dirty.includes(field)) {
      if (stamps[field]) meta.base[field] = stamps[field];
      else delete meta.base[field];
      continue;
    }
    push.push(field);
    take(result, stamps[field] === meta.base[field] ? local : merged, field);
  }

  // Persist the clearing rather than filtering on read: otherwise every
  // device keeps re-hiding a list that is still sitting in the document, and
  // the next version to read it plainly would bring the five tasks back.
  const cleaned = withoutLegacyStarter(result);
  if (cleaned !== result && !push.includes('defaultTasks')) push.push('defaultTasks');

  writeLocal(uid, cleaned);
  writeMeta(uid, meta);
  if (push.length) void savePrefs(cleaned, push).catch(() => {});
  return cleaned;
}

/**
 * Local first, exactly like `cloudStore`: the device copy is what the UI reads,
 * the cloud is a mirror. Returns whatever it can — a network failure here must
 * not stop a week from loading.
 *
 * Cheap enough to call on every return to the tab, and `usePrefs` does: that
 * re-read is how one device ever sees another's groups, routine and goals.
 */
export async function loadPrefs(): Promise<Prefs> {
  const uid = auth?.currentUser?.uid ?? null;
  if (!uid || !db) {
    const local = withoutLegacyStarter(readLocal(uid));
    // Signed out the fix is local-only, and savePrefs is the write either way.
    if (isLegacyStarter(readLocal(uid).defaultTasks)) await savePrefs(local);
    return local;
  }

  let raw: unknown;
  try {
    const snap = await getDoc(prefsDoc(uid));
    raw = snap.exists() ? snap.data() : null;
  } catch {
    return withoutLegacyStarter(readLocal(uid));
  }
  return reconcile(uid, raw);
}

/**
 * Cloud writes go out one at a time.
 *
 * `firestore/lite` keeps no local mutation queue — every `setDoc` is a bare
 * HTTP request — so two saves in flight together can land in either order,
 * and an older value arriving late would put the previous avatar or task list
 * back over the newer one. Ordering is the fix: every save is built from the
 * latest local state at the moment it is called, so writes issued in order
 * are correct in order; they only needed to stay in that order on the way out.
 */
let queued: Promise<unknown> = Promise.resolve();

/** The revision of the newest write issued for each `uid:field`, this tab. */
const latestRev = new Map<string, string>();

/**
 * Resolves once every queued prefs write has landed, and rejects if the last
 * one did not. `savePrefs` is fired and forgotten everywhere else, so this is
 * the only way to ask whether the device copy is safe to discard yet.
 */
export function flushPrefs(): Promise<void> {
  return queued.then(() => {});
}

/**
 * Forgets this account's cached prefs on this device.
 *
 * The standing-task list and the profile photo both live here, and nothing
 * ever removed them: sign out on a shared Chromebook and the next person could
 * read the previous one's routine and see their picture straight out of
 * devtools. The uid scoping kept it off the screen, which is not the same as
 * it being gone.
 *
 * Only safe once `flushPrefs` has resolved, since an unsent edit exists
 * nowhere else.
 */
export function clearLocalPrefs(uid: string): void {
  try {
    localStorage.removeItem(localKey(uid));
    localStorage.removeItem(metaKey(uid));
  } catch {
    /* Private mode. Nothing was stored to begin with. */
  }
}

/**
 * Writes the prefs to the device, then sends `fields` — only those — to the
 * account.
 *
 * The device write is synchronous and cannot fail. The fields are flagged
 * dirty before the request and cleared only when it lands, and only if no
 * newer write of the same field was issued meanwhile; a field still dirty at
 * the next load is sent again then.
 */
export function savePrefs(prefs: Prefs, fields: PrefsField[] = FIELDS): Promise<void> {
  const uid = auth?.currentUser?.uid ?? null;
  const clean = normalise(prefs);
  writeLocal(uid, clean); // Synchronous, cannot fail.
  if (!uid || !db || fields.length === 0) return Promise.resolve();

  const meta = readMeta(uid);
  meta.dirty = FIELDS.filter((f) => meta.dirty.includes(f) || fields.includes(f));
  writeMeta(uid, meta);

  const rev = newId();
  const payload: Record<string, unknown> = {};
  const stamps: Stamps = {};
  for (const field of fields) {
    payload[field] = clean[field];
    stamps[field] = rev;
    latestRev.set(`${uid}:${field}`, rev);
  }
  payload.stamps = stamps;

  // The leading catch is load-bearing: without it one failed write leaves a
  // rejected promise at the head of the queue and every later save is dropped.
  const write = queued
    .catch(() => {})
    .then(async () => {
      // `merge` is the per-field part: the document's other fields, and the
      // other entries in `stamps`, are left exactly as they are.
      await setDoc(prefsDoc(uid), payload, { merge: true });
      const after = readMeta(uid);
      for (const field of fields) {
        after.base[field] = rev;
        if (latestRev.get(`${uid}:${field}`) === rev) {
          after.dirty = after.dirty.filter((f) => f !== field);
        }
      }
      writeMeta(uid, after);
    });

  queued = write;
  return write.then(() => {});
}

/**
 * Moves the groups, routine and goals set up while signed out into the
 * account that just signed in. Called by `migrateLocalToCloud`, once per
 * account per device, alongside the weeks.
 *
 * It did not exist, and the weeks went alone: every task arrived pointing at a
 * group id the account had never heard of, so every group mark vanished, and
 * the routine and goals stayed behind in a signed-out slot nothing read again.
 *
 * The account's own prefs lead; the signed-out ones only add to them. Throws
 * if the account can't be read, so a migration attempted offline is simply
 * retried at the next sign-in rather than merged against a guess.
 */
export async function migrateAnonPrefs(): Promise<void> {
  const uid = auth?.currentUser?.uid ?? null;
  if (!uid || !db) return;

  const anon = withoutLegacyStarter(readLocal(null));
  if (hasContent(anon)) {
    const snap = await getDoc(prefsDoc(uid));
    const account = reconcile(uid, snap.exists() ? snap.data() : null);
    const merged = mergePrefs(account, anon);
    const changed = FIELDS.filter((f) => !sameValue(merged[f], account[f]));
    if (changed.length) await savePrefs(merged, changed);
  }

  // The signed-out copy is now in the account; left here it is a leak to the
  // next person who signs in on this device.
  try {
    localStorage.removeItem(ANON_KEY);
  } catch {
    /* Private mode. */
  }
}
