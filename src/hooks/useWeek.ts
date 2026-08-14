import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayId, SyncState, Task, Week } from '../types';
import type { StandingTask } from '../lib/prefs';
import { flushPending, type WeekStore } from '../lib/storage';
import { createWeek, currentWeekStart, standingTasksFor, uid } from '../lib/week';

const SAVE_DEBOUNCE_MS = 300;

/**
 * Owns the current Week and every mutation to it.
 *
 * Writes are debounced (spec §7) but always keyed to the week they came from —
 * a pending save is flushed before switching weeks, so edits can never land on
 * the wrong week's row.
 */
export function useWeek(store: WeekStore, ready: boolean, defaultTasks: StandingTask[] = []) {
  const [weekStart, setWeekStartRaw] = useState<string>(currentWeekStart);
  const [week, setWeek] = useState<Week | null>(null);
  const [knownWeeks, setKnownWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncState>('idle');
  const [error, setError] = useState<string | null>(null);
  /** Bumped to force a re-read — the only way a tab ever sees another device. */
  const [reloadToken, setReloadToken] = useState(0);

  /**
   * The calendar week that was current when `weekStart` was last set. It tells
   * "sitting on this week" apart from "navigated here deliberately", so a tab
   * left open across Sunday midnight rolls forward instead of quietly writing
   * every later edit into last week's document.
   */
  const anchorRef = useRef(currentWeekStart());

  const weekRef = useRef<Week | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Week | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Read through a ref so that editing the standing-task list doesn't re-run
     the load effect and swap the week out from under an edit in progress. The
     list only ever matters at the moment a week is created. */
  const defaultsRef = useRef(defaultTasks);
  defaultsRef.current = defaultTasks;

  /* ── Saving ───────────────────────────────────────────────────────────── */

  const commit = useCallback(async (toSave: Week) => {
    setSync('saving');
    try {
      await storeRef.current.saveWeek(toSave);
      setError(null);
      setSync('saved');
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSync('idle'), 1600);
      setKnownWeeks((prev) =>
        prev.includes(toSave.weekStart)
          ? prev
          : [...prev, toSave.weekStart].sort().reverse(),
      );
    } catch (e) {
      setSync('error');
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }, []);

  const flush = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) await commit(pending);
  }, [commit]);

  const scheduleSave = useCallback(
    (next: Week) => {
      pendingRef.current = next;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) void commit(pending);
      }, SAVE_DEBOUNCE_MS);
    },
    [commit],
  );

  /* ── Loading ──────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!ready) return;
    let active = true;

    setLoading(true);
    (async () => {
      try {
        const existing = await storeRef.current.loadWeek(weekStart);
        if (!active) return;
        // A week you've navigated to but never touched is created in memory and
        // only persisted once you actually edit it.
        const resolved = existing ?? createWeek(weekStart, defaultsRef.current);
        weekRef.current = resolved;
        setWeek(resolved);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not load this week.');
        const fallback = createWeek(weekStart, defaultsRef.current);
        weekRef.current = fallback;
        setWeek(fallback);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [weekStart, ready, store, reloadToken]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    storeRef.current
      .listWeekStarts()
      .then((list) => {
        if (active) setKnownWeeks(list);
      })
      .catch(() => {
        /* Non-fatal: the selector just falls back to the current week. */
      });
    return () => {
      active = false;
    };
  }, [ready, store]);

  /* ── Leaving and coming back ──────────────────────────────────────────────
     Hiding flushes pending work. Returning re-reads, which is the entire
     mechanism by which one device ever sees what another one wrote — there is
     no realtime subscription, and for two devices that are never used at the
     same moment there doesn't need to be. Without this, a tab shows whatever
     it loaded at mount forever, and the next click uploads that stale snapshot
     over the newer week. */
  useEffect(() => {
    const onHide = () => {
      const pending = pendingRef.current;
      // Clear both, or a tab frozen inside the 300ms debounce window wakes up
      // and re-uploads its pre-freeze snapshot over newer work.
      pendingRef.current = null;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (pending) void commit(pending);
    };

    const onShow = () => {
      // Never clobber an edit that hasn't been written yet.
      if (pendingRef.current || timerRef.current) return;

      const nowWeek = currentWeekStart();
      if (nowWeek !== anchorRef.current) {
        const wasSittingOnCurrent = weekStart === anchorRef.current;
        anchorRef.current = nowWeek;
        if (wasSittingOnCurrent) {
          setWeekStartRaw(nowWeek); // Re-reads via the load effect.
          return;
        }
      }

      void flushPending().finally(() => setReloadToken((n) => n + 1));
    };

    const onVisibility = () => (document.hidden ? onHide() : onShow());

    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onShow);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onShow);
    };
  }, [commit, weekStart]);

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const mutate = useCallback(
    (fn: (w: Week) => Week) => {
      const current = weekRef.current;
      if (!current) return;
      const next = fn(current);
      weekRef.current = next;
      setWeek(next);
      scheduleSave(next);
    },
    [scheduleSave],
  );

  const mapDay = useCallback(
    (dayId: DayId, fn: (tasks: Task[]) => Task[]) =>
      mutate((w) => ({
        ...w,
        days: w.days.map((d) => (d.id === dayId ? { ...d, tasks: fn(d.tasks) } : d)),
      })),
    [mutate],
  );

  const toggleTask = useCallback(
    (dayId: DayId, taskId: string) =>
      mapDay(dayId, (tasks) =>
        tasks.map((t) =>
          t.id === taskId && t.label.trim() !== '' ? { ...t, done: !t.done } : t,
        ),
      ),
    [mapDay],
  );

  const setTaskLabel = useCallback(
    (dayId: DayId, taskId: string, label: string) =>
      mapDay(dayId, (tasks) =>
        tasks.map((t) =>
          // Clearing a label empties the row, so its checkmark must go too —
          // otherwise a blank row could carry a stale `done`.
          t.id === taskId ? { ...t, label, done: label.trim() === '' ? false : t.done } : t,
        ),
      ),
    [mapDay],
  );

  /** Returns the new row's id so the caller can focus it immediately. */
  const addTask = useCallback(
    (dayId: DayId, label = '') => {
      const id = uid();
      mapDay(dayId, (tasks) => [...tasks, { id, label, done: false }]);
      return id;
    },
    [mapDay],
  );

  const removeTask = useCallback(
    (dayId: DayId, taskId: string) =>
      mapDay(dayId, (tasks) => tasks.filter((t) => t.id !== taskId)),
    [mapDay],
  );

  const setMeta = useCallback(
    (patch: Partial<Pick<Week, 'focus' | 'reward' | 'affirmation'>>) =>
      mutate((w) => ({ ...w, ...patch })),
    [mutate],
  );

  /**
   * Adds the standing tasks to the days they are set for in the week currently
   * open, skipping any a day already has. Purely additive and explicitly
   * invoked — a new week seeds itself, but a week already in progress is never
   * rewritten without being asked. Days a task excludes are left untouched
   * rather than having it removed: this only ever adds.
   */
  const applyStandingTasks = useCallback(
    (standing: StandingTask[]) =>
      mutate((w) => ({
        ...w,
        days: w.days.map((day) => {
          const have = new Set(day.tasks.map((t) => t.label.trim().toLowerCase()));
          const missing = standingTasksFor(standing, day.id)
            .map((l) => l.trim())
            .filter((l) => l && !have.has(l.toLowerCase()))
            .map((label) => ({ id: uid(), label, done: false }));
          return missing.length ? { ...day, tasks: [...day.tasks, ...missing] } : day;
        }),
      })),
    [mutate],
  );

  /** Clears every checkmark for the week. Task text is preserved (spec §7). */
  const clearChecks = useCallback(
    () =>
      mutate((w) => ({
        ...w,
        days: w.days.map((d) => ({
          ...d,
          tasks: d.tasks.map((t) => ({ ...t, done: false })),
        })),
      })),
    [mutate],
  );

  /* ── Navigation ───────────────────────────────────────────────────────── */

  const goToWeek = useCallback(
    (next: string) => {
      if (next === weekStart) return;
      void flush();
      setWeekStartRaw(next);
    },
    [flush, weekStart],
  );

  return {
    week,
    weekStart,
    knownWeeks,
    loading,
    sync,
    error,
    goToWeek,
    toggleTask,
    setTaskLabel,
    addTask,
    removeTask,
    setMeta,
    clearChecks,
    applyStandingTasks,
    flush,
  };
}
