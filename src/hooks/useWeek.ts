import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayId, SyncState, Task, Week } from '../types';
import type { WeekStore } from '../lib/storage';
import { createWeek, currentWeekStart, uid } from '../lib/week';

const SAVE_DEBOUNCE_MS = 300;

/**
 * Owns the current Week and every mutation to it.
 *
 * Writes are debounced (spec §7) but always keyed to the week they came from —
 * a pending save is flushed before switching weeks, so edits can never land on
 * the wrong week's row.
 */
export function useWeek(store: WeekStore, ready: boolean) {
  const [weekStart, setWeekStartRaw] = useState<string>(currentWeekStart);
  const [week, setWeek] = useState<Week | null>(null);
  const [knownWeeks, setKnownWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncState>('idle');
  const [error, setError] = useState<string | null>(null);

  const weekRef = useRef<Week | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Week | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const resolved = existing ?? createWeek(weekStart);
        weekRef.current = resolved;
        setWeek(resolved);
        setError(null);
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : 'Could not load this week.');
        const fallback = createWeek(weekStart);
        weekRef.current = fallback;
        setWeek(fallback);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [weekStart, ready, store]);

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

  /* Flush anything pending if the tab is closed or backgrounded mid-edit. */
  useEffect(() => {
    const onHide = () => {
      const pending = pendingRef.current;
      if (pending) void commit(pending);
    };
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('beforeunload', onHide);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [commit]);

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

  const addTask = useCallback(
    (dayId: DayId, label = '') =>
      mapDay(dayId, (tasks) => [...tasks, { id: uid(), label, done: false }]),
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
    flush,
  };
}
