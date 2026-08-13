import type { Day, DayId, Task, Week } from '../types';

export const DAY_IDS: DayId[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export const DAY_LABELS: Record<DayId, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export const DAY_SHORT: Record<DayId, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

/** Rows each day ships with on a fresh week (spec §4.4). */
const ROWS_PER_DAY = 10;

/** A few prefilled rows so a new week never looks broken or empty. */
const STARTER_TASKS = [
  'Wake up at 6:00',
  'Gym',
  'Read 10 pages',
  'Drink 2L of water',
  'Cook a healthy meal',
];

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ── Date helpers ──────────────────────────────────────────────────────────
   All dates are handled as local-time calendar dates and serialised as
   YYYY-MM-DD. We deliberately avoid `new Date(isoString)` parsing, which
   treats a bare date as UTC and can shift the day across timezones. */

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** ISO date of the Monday on or before `d`. */
export function mondayOf(d: Date = new Date()): string {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  // getDay(): 0=Sun … 6=Sat. Shift so Monday is the week's first day.
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return toISODate(copy);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function currentWeekStart(): string {
  return mondayOf(new Date());
}

export function todayISO(): string {
  return toISODate(new Date());
}

/** "2025-05-18" -> "18.5.25", matching the source spreadsheet's day headers. */
export function formatShortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${String(d.getFullYear()).slice(2)}`;
}

/** "2025-05-18" -> "18 May 2025", used in the week selector. */
export function formatLongDate(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* ── Week construction ─────────────────────────────────────────────────── */

function makeTasks(prefill: boolean): Task[] {
  return Array.from({ length: ROWS_PER_DAY }, (_, i) => ({
    id: uid(),
    label: prefill ? (STARTER_TASKS[i] ?? '') : '',
    done: false,
  }));
}

export function createWeek(weekStart: string, prefill = true): Week {
  return {
    weekStart,
    focus: '',
    reward: '',
    affirmation: '',
    days: DAY_IDS.map((id, i) => ({
      id,
      label: DAY_LABELS[id],
      date: addDays(weekStart, i),
      tasks: makeTasks(prefill),
    })),
  };
}

/* ── Derived values (spec §3) ──────────────────────────────────────────────
   Never stored — always recomputed, so the counters cannot drift out of sync
   with the checkboxes. Blank placeholder rows are not tasks and are excluded
   from every count; otherwise a fresh week would read 0/10 with 5 phantom
   entries. */

export function realTasks(day: Day): Task[] {
  return day.tasks.filter((t) => t.label.trim() !== '');
}

export function completedCount(day: Day): number {
  return realTasks(day).filter((t) => t.done).length;
}

export function totalCount(day: Day): number {
  return realTasks(day).length;
}

export function leftCount(day: Day): number {
  return totalCount(day) - completedCount(day);
}

export function completionPct(day: Day): number {
  const total = totalCount(day);
  if (total === 0) return 0;
  return Math.round((completedCount(day) / total) * 100);
}

/** Total done / total tasks across the whole week — "it feels more earned". */
export function weekOverallPct(week: Week): number {
  let done = 0;
  let total = 0;
  for (const day of week.days) {
    done += completedCount(day);
    total += totalCount(day);
  }
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export function weekTotals(week: Week): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const day of week.days) {
    done += completedCount(day);
    total += totalCount(day);
  }
  return { done, total };
}

/* ── Validation ────────────────────────────────────────────────────────────
   Anything arriving from localStorage or the network is untrusted: it may be
   from an older schema, hand-edited, or truncated. Normalise it into a
   well-formed Week rather than letting a bad shape crash the render. */

export function normalizeWeek(raw: unknown, weekStart: string): Week {
  const base = createWeek(weekStart, false);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Partial<Week>;

  const days = DAY_IDS.map((id, i) => {
    const incoming = Array.isArray(r.days) ? r.days.find((d) => d?.id === id) : undefined;
    const tasks: Task[] = Array.isArray(incoming?.tasks)
      ? incoming.tasks
          .filter((t): t is Task => typeof t === 'object' && t !== null)
          .map((t) => ({
            id: typeof t.id === 'string' ? t.id : uid(),
            label: typeof t.label === 'string' ? t.label : '',
            done: t.done === true,
          }))
      : [];

    // Keep at least the baseline row count so the column never looks collapsed.
    while (tasks.length < ROWS_PER_DAY) {
      tasks.push({ id: uid(), label: '', done: false });
    }

    return {
      id,
      label: DAY_LABELS[id],
      date: addDays(weekStart, i),
      tasks,
    } satisfies Day;
  });

  return {
    weekStart,
    focus: typeof r.focus === 'string' ? r.focus : '',
    reward: typeof r.reward === 'string' ? r.reward : '',
    affirmation: typeof r.affirmation === 'string' ? r.affirmation : '',
    days,
  };
}
