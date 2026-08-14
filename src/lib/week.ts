import type { Day, DayId, Task, Week } from '../types';
import type { StandingTask } from './prefs';

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

/* The old hardcoded starter list now lives in `lib/prefs.ts` as the one-time
   seed for a new user's standing tasks. `createWeek` takes whatever the user
   has set instead, so a new week arrives already filled with their routine. */

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

/** "2025-05-18" -> "18.5.25". Compact form used in day list rows. */
export const shortDayDate = formatShortDate;

/** "2025-05-18" -> "18.5". Compact enough for a week-strip cell. */
export function cellDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getDate()}.${d.getMonth() + 1}`;
}

/** "2025-05-18" -> "18 May". Used in today's card header. */
export function longDayDate(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' });
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

/**
 * Days used to ship padded to a fixed 10 rows, so a fresh day carried 5 real
 * tasks and 5 permanently blank ones. Blanks render as live inputs with an
 * "Add a task" placeholder, which meant every expanded day showed six separate
 * ways to add a task. A day now contains only real tasks; the single `+ add
 * task` button appends the one blank row that is being typed into.
 */
function makeTasks(starter: string[]): Task[] {
  return starter.map((label) => ({ id: uid(), label, done: false }));
}

/** The standing tasks that belong to one day, in the order they were listed. */
export function standingTasksFor(standing: StandingTask[], day: DayId): string[] {
  return standing.filter((t) => t.days.includes(day)).map((t) => t.label);
}

/**
 * `starter` is the user's standing tasks, seeded into the days each one is set
 * for. Pass `[]` (or nothing) for a bare week — `normalizeWeek` does exactly
 * that, since a week arriving from storage must be reconstructed as it was
 * saved and never re-seeded.
 */
export function createWeek(weekStart: string, starter: StandingTask[] = []): Week {
  return {
    weekStart,
    focus: '',
    reward: '',
    affirmation: '',
    days: DAY_IDS.map((id, i) => ({
      id,
      label: DAY_LABELS[id],
      date: addDays(weekStart, i),
      tasks: makeTasks(standingTasksFor(starter, id)),
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

/**
 * Running total of completed tasks across the week, Monday first. Feeds the
 * pace curve, which is the only thing in the app that answers "am I on track"
 * rather than "how much is done".
 */
export function weekCumulative(week: Week): number[] {
  let running = 0;
  return week.days.map((day) => {
    running += completedCount(day);
    return running;
  });
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
  const base = createWeek(weekStart);
  if (typeof raw !== 'object' || raw === null) return base;
  const r = raw as Partial<Week>;

  const days = DAY_IDS.map((id, i) => {
    const incoming = Array.isArray(r.days) ? r.days.find((d) => d?.id === id) : undefined;
    // Blank rows are dropped on load, which also sweeps out the padding that
    // older saved weeks are carrying. This has to happen here as well as in
    // makeTasks: normalizeWeek runs on every load for both stores, so a fix
    // that only touched the seed would silently re-pad on the next refresh.
    // Safe to do at this point — normalizeWeek never runs mid-edit, so it
    // cannot delete a row someone is currently typing into.
    const tasks: Task[] = Array.isArray(incoming?.tasks)
      ? incoming.tasks
          .filter((t): t is Task => typeof t === 'object' && t !== null)
          .map((t) => ({
            id: typeof t.id === 'string' ? t.id : uid(),
            label: typeof t.label === 'string' ? t.label : '',
            done: t.done === true,
          }))
          .filter((t) => t.label.trim() !== '')
      : [];

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
