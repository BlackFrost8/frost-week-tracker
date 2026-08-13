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

/* ── Local ─────────────────────────────────────────────────────────────── */

const LOCAL_KEY = 'frost-week-tracker:v1';

type LocalShape = Record<string, Week>;

function readAll(): LocalShape {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as LocalShape;
  } catch {
    return {};
  }
}

function writeAll(data: LocalShape): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

export const localStore: WeekStore = {
  kind: 'local',

  async listWeekStarts() {
    return Object.keys(readAll()).sort().reverse();
  },

  async loadWeek(weekStart) {
    const raw = readAll()[weekStart];
    return raw ? normalizeWeek(raw, weekStart) : null;
  },

  async saveWeek(week) {
    const all = readAll();
    all[week.weekStart] = week;
    writeAll(all);
  },

  async deleteWeek(weekStart) {
    const all = readAll();
    delete all[weekStart];
    writeAll(all);
  },
};

/* ── Cloud ─────────────────────────────────────────────────────────────── */

/**
 * One document per week at `users/{uid}/weeks/{weekStart}`. The week start is
 * the document id, which makes `listWeekStarts` a pure id read with no query
 * or index, and makes every write an idempotent overwrite of one document.
 *
 * `Week.days` is an array of day objects that each contain a `tasks` array.
 * Firestore forbids an array directly inside an array, but an array of maps
 * that each hold an array is fine — so the existing type serialises as-is.
 */
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

export const cloudStore: WeekStore = {
  kind: 'cloud',

  async listWeekStarts() {
    const snap = await getDocs(weeksCol(requireDb(), requireUid()));
    return snap.docs.map((d) => d.id).sort().reverse();
  },

  async loadWeek(weekStart) {
    const snap = await getDoc(doc(weeksCol(requireDb(), requireUid()), weekStart));
    if (!snap.exists()) return null;
    return normalizeWeek(snap.data(), weekStart);
  },

  async saveWeek(week) {
    await setDoc(doc(weeksCol(requireDb(), requireUid()), week.weekStart), {
      weekStart: week.weekStart,
      focus: week.focus,
      reward: week.reward,
      affirmation: week.affirmation,
      days: week.days,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteWeek(weekStart) {
    await deleteDoc(doc(weeksCol(requireDb(), requireUid()), weekStart));
  },
};

/* ── Migration ─────────────────────────────────────────────────────────────
   First time you sign in, anything you'd already built up offline is pushed to
   the cloud. Cloud rows always win on conflict — the account is the source of
   truth once it exists, and we never clobber data written from another device. */

/** Keyed per account: signing a second Google account in on the same browser
    used to silently skip its migration, because the flag was global. */
const migratedFlag = (uid: string) => `frost-week-tracker:migrated:${uid}`;

export async function migrateLocalToCloud(): Promise<number> {
  const uid = requireUid();
  const MIGRATED_FLAG = migratedFlag(uid);
  if (localStorage.getItem(MIGRATED_FLAG) === 'yes') return 0;

  const localWeeks = readAll();
  const weekStarts = Object.keys(localWeeks);
  if (weekStarts.length === 0) {
    localStorage.setItem(MIGRATED_FLAG, 'yes');
    return 0;
  }

  const existing = new Set(await cloudStore.listWeekStarts());
  let uploaded = 0;

  for (const weekStart of weekStarts) {
    if (existing.has(weekStart)) continue;
    const week = normalizeWeek(localWeeks[weekStart], weekStart);
    // An empty shell week isn't worth uploading.
    const hasContent =
      week.focus || week.reward || week.affirmation ||
      week.days.some((d) => d.tasks.some((t) => t.label.trim() !== ''));
    if (!hasContent) continue;

    await cloudStore.saveWeek(week);
    uploaded += 1;
  }

  localStorage.setItem(MIGRATED_FLAG, 'yes');
  return uploaded;
}
