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

function markClean(base: string, weekStart: string, updatedAt: string): void {
  const meta = readMeta(base);
  meta[weekStart] = { updatedAt, dirty: false };
  writeJSON(metaKey(base), meta);
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

async function pushWeek(uid: string, week: Week, updatedAt: string): Promise<void> {
  await setDoc(doc(weeksCol(requireDb(), uid), week.weekStart), {
    weekStart: week.weekStart,
    focus: week.focus,
    reward: week.reward,
    affirmation: week.affirmation,
    days: week.days,
    updatedAt,
  });
  markClean(mirrorKey(uid), week.weekStart, updatedAt);
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
    const localRaw = readWeeks(base)[weekStart];
    const localMeta = readMeta(base)[weekStart];

    let cloudRaw: CloudDoc | null = null;
    try {
      const snap = await getDoc(doc(weeksCol(requireDb(), uid), weekStart));
      cloudRaw = snap.exists() ? (snap.data() as CloudDoc) : null;
    } catch (e) {
      // Network down. Serving the mirror is strictly better than an error
      // screen; the header's sync state is what reports the connection.
      if (localRaw) return normalizeWeek(localRaw, weekStart);
      throw e;
    }

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

    const week = normalizeWeek(cloudRaw, weekStart);
    const weeks = readWeeks(base);
    weeks[weekStart] = week;
    writeJSON(base, weeks);
    markClean(base, weekStart, cloudAt || new Date().toISOString());
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
  const meta = readMeta(base);
  const stale = Object.keys(meta).filter((ws) => meta[ws]?.dirty);
  if (stale.length === 0) return 0;

  const weeks = readWeeks(base);
  let pushed = 0;
  for (const weekStart of stale) {
    const raw = weeks[weekStart];
    if (!raw) continue;
    try {
      await pushWeek(uid, normalizeWeek(raw, weekStart), meta[weekStart].updatedAt);
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
