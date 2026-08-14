import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { auth, db } from './firebase';

/**
 * Account preferences, as opposed to device preferences.
 *
 * The theme lives in `theme.ts` and stays on the device, because it's about
 * the screen in front of you. This is the other kind: your standing tasks are
 * *content*, so they follow the account the same way weeks do — otherwise
 * setting them up on the PC would leave the Chromebook still typing them out
 * by hand, which is the whole complaint this feature answers.
 */

export type Prefs = {
  /** Seeded into every day of a newly created week, in this order. */
  defaultTasks: string[];
};

export const EMPTY_PREFS: Prefs = { defaultTasks: [] };

/** What a brand-new user gets, so a first week never looks broken or empty. */
export const STARTER_DEFAULTS = [
  'Wake up at 6:00',
  'Gym',
  'Read 10 pages',
  'Drink 2L of water',
  'Cook a healthy meal',
];

const ANON_KEY = 'frost-week-tracker:prefs';
const localKey = (uid: string | null) => (uid ? `frost-week-tracker:prefs:${uid}` : ANON_KEY);

function normalise(raw: unknown): Prefs {
  if (typeof raw !== 'object' || raw === null) return EMPTY_PREFS;
  const list = (raw as Partial<Prefs>).defaultTasks;
  if (!Array.isArray(list)) return EMPTY_PREFS;
  return {
    defaultTasks: list
      .filter((t): t is string => typeof t === 'string')
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, 20),
  };
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
  const local = readLocal(uid);
  if (!uid || !db) return local;

  try {
    const snap = await getDoc(prefsDoc(uid));
    if (!snap.exists()) {
      // First sign-in on this account: adopt whatever was set up offline.
      if (local.defaultTasks.length > 0) await savePrefs(local);
      return local;
    }
    const cloud = normalise(snap.data());
    writeLocal(uid, cloud);
    return cloud;
  } catch {
    return local;
  }
}

export async function savePrefs(prefs: Prefs): Promise<void> {
  const uid = auth?.currentUser?.uid ?? null;
  const clean = normalise(prefs);
  writeLocal(uid, clean); // Synchronous, cannot fail.
  if (!uid || !db) return;
  await setDoc(prefsDoc(uid), { defaultTasks: clean.defaultTasks });
}
