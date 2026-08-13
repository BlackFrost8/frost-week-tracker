import type { StorageKind, Week } from '../types';
import { normalizeWeek } from './week';
import { supabase } from './supabase';

/**
 * Everything the app needs from persistence. Two implementations satisfy it —
 * localStorage and Supabase — and the UI never knows which one it's talking to.
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

type WeekRow = {
  week_start: string;
  focus: string | null;
  reward: string | null;
  affirmation: string | null;
  days: unknown;
};

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export const cloudStore: WeekStore = {
  kind: 'cloud',

  async listWeekStarts() {
    const { data, error } = await requireClient()
      .from('weeks')
      .select('week_start')
      .order('week_start', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => r.week_start as string);
  },

  async loadWeek(weekStart) {
    const { data, error } = await requireClient()
      .from('weeks')
      .select('week_start, focus, reward, affirmation, days')
      .eq('week_start', weekStart)
      .maybeSingle<WeekRow>();
    if (error) throw error;
    if (!data) return null;

    return normalizeWeek(
      {
        weekStart: data.week_start,
        focus: data.focus ?? '',
        reward: data.reward ?? '',
        affirmation: data.affirmation ?? '',
        days: data.days,
      },
      weekStart,
    );
  },

  async saveWeek(week) {
    const client = requireClient();
    const { data: userData, error: userError } = await client.auth.getUser();
    if (userError) throw userError;
    const userId = userData.user?.id;
    if (!userId) throw new Error('Not signed in.');

    // Upsert on (user_id, week_start) so repeated autosaves update one row.
    const { error } = await client.from('weeks').upsert(
      {
        user_id: userId,
        week_start: week.weekStart,
        focus: week.focus,
        reward: week.reward,
        affirmation: week.affirmation,
        days: week.days,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,week_start' },
    );
    if (error) throw error;
  },

  async deleteWeek(weekStart) {
    const { error } = await requireClient().from('weeks').delete().eq('week_start', weekStart);
    if (error) throw error;
  },
};

/* ── Migration ─────────────────────────────────────────────────────────────
   First time you sign in, anything you'd already built up offline is pushed to
   the cloud. Cloud rows always win on conflict — the account is the source of
   truth once it exists, and we never clobber data written from another device. */

const MIGRATED_FLAG = 'frost-week-tracker:migrated';

export async function migrateLocalToCloud(): Promise<number> {
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

export function resetMigrationFlag(): void {
  localStorage.removeItem(MIGRATED_FLAG);
}
