import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import type { DayId } from '../types';
import { auth, db } from './firebase';
import { DAY_IDS } from './week';

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
};

export type Prefs = {
  /** Seeded into each matching day of a newly created week, in this order. */
  defaultTasks: StandingTask[];
  /**
   * A square data URL, or null to fall back to the Google account photo.
   *
   * Kept in the settings document rather than Firebase Storage: a 192px JPEG
   * is ~12KB, three orders of magnitude under the 1MB document ceiling, and it
   * means the picture rides the same read the standing tasks already do
   * instead of needing a second product enabled and a second set of rules.
   */
  avatar: string | null;
};

export const EMPTY_PREFS: Prefs = { defaultTasks: [], avatar: null };

const everyDay = (): DayId[] => [...DAY_IDS];

/* There is deliberately no starter list. A routine you didn't choose is
   someone else's routine, and five tasks you have to delete before you can
   begin are worse than a blank card. An empty day offers what that weekday
   held last week instead — nothing is saved until one is clicked. */

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
    return label ? { label, days: everyDay() } : null;
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

  return { label, days };
}

function normalise(raw: unknown): Prefs {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PREFS;
  const r = raw as Partial<Prefs>;

  const defaultTasks = Array.isArray(r.defaultTasks)
    ? r.defaultTasks
        .map(toStandingTask)
        .filter((t): t is StandingTask => t !== null)
        .slice(0, 20)
    : [];

  // Only ever a data URL: a remote URL here would be somewhere else's image
  // loading on every render of the header.
  const avatar =
    typeof r.avatar === 'string' && r.avatar.startsWith('data:image/') ? r.avatar : null;

  return { defaultTasks, avatar };
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

/**
 * Local first, exactly like `cloudStore`: the device copy is what the UI reads,
 * the cloud is a mirror. Returns whatever it can — a network failure here must
 * not stop a week from loading.
 */
export async function loadPrefs(): Promise<Prefs> {
  const uid = auth?.currentUser?.uid ?? null;
  const local = withoutLegacyStarter(readLocal(uid));
  if (!uid || !db) {
    // Signed out the fix is local-only, and savePrefs is the write either way.
    if (isLegacyStarter(readLocal(uid).defaultTasks)) await savePrefs(local);
    return local;
  }

  try {
    const snap = await getDoc(prefsDoc(uid));
    if (!snap.exists()) {
      // First sign-in on this account: adopt whatever was set up offline —
      // minus the abandoned seed, which must not be carried into the account.
      if (local.defaultTasks.length > 0 || local.avatar) await savePrefs(local);
      return local;
    }
    const cloud = normalise(snap.data());
    const cleaned = withoutLegacyStarter(cloud);
    // Persist the clearing rather than filtering on read: otherwise every
    // device keeps re-hiding a list that is still sitting in the document, and
    // the next version to read it plainly would bring the five tasks back.
    if (cleaned !== cloud) {
      await savePrefs(cleaned);
      return cleaned;
    }
    writeLocal(uid, cloud);
    return cloud;
  } catch {
    return local;
  }
}

/**
 * Cloud writes go out one at a time.
 *
 * `firestore/lite` keeps no local mutation queue — every `setDoc` is a bare
 * HTTP request — so two saves in flight together can land in either order.
 * Each one writes the whole document, so the straggler doesn't merely lose its
 * own field: an older snapshot arriving late puts the *previous* avatar or the
 * previous task list back over the newer one. Saving a picture while the
 * standing-task debounce is still in the air is enough to do it. And because
 * `writeLocal` already succeeded, the device that made the edit goes on
 * showing the right value — the loss only surfaces on another device, or on
 * the next read from the cloud.
 *
 * Ordering is the whole fix. Every save merges from the latest local state at
 * the moment it is called, so writes issued in order are correct in order;
 * they only needed to stay in that order on the way out.
 */
let queued: Promise<unknown> = Promise.resolve();

export function savePrefs(prefs: Prefs): Promise<void> {
  const uid = auth?.currentUser?.uid ?? null;
  const clean = normalise(prefs);
  writeLocal(uid, clean); // Synchronous, cannot fail.
  if (!uid || !db) return Promise.resolve();

  // The leading catch is load-bearing: without it one failed write leaves a
  // rejected promise at the head of the queue and every later save is dropped.
  const write = queued
    .catch(() => {})
    .then(() => setDoc(prefsDoc(uid), { defaultTasks: clean.defaultTasks, avatar: clean.avatar }));

  queued = write;
  return write.then(() => {});
}
