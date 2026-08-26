import { useCallback, useEffect, useRef, useState } from 'react';
import type { DayId, SyncState, Task, Week } from '../types';
import type { StandingTask } from '../lib/prefs';
import { flushPending, type WeekStore } from '../lib/storage';
import { addDays, createWeek, currentWeekStart, standingTasksFor, uid } from '../lib/week';
import { useToday } from './useToday';

const SAVE_DEBOUNCE_MS = 300;

/** Lower-cased label -> group id, for the standing tasks that name a group. */
function standingGroups(standing: StandingTask[]): Map<string, string> {
  const byLabel = new Map<string, string>();
  for (const t of standing) {
    const key = t.label.trim().toLowerCase();
    if (key && t.groupId) byLabel.set(key, t.groupId);
  }
  return byLabel;
}

/**
 * The task, filed under its standing task's group — or the very same object
 * back when there is nothing to change.
 *
 * Returning the identical reference is load-bearing: it is what lets the
 * callers above tell a real reconcile from a pass that found nothing, and so
 * what keeps an idempotent sweep from scheduling a write.
 */
function fileFromStanding(task: Task, wanted: Map<string, string>): Task {
  if (task.groupId) return task;
  const groupId = wanted.get(task.label.trim().toLowerCase());
  return groupId ? { ...task, groupId } : task;
}

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
  const [previousWeek, setPreviousWeek] = useState<Week | null>(null);
  const [knownWeeks, setKnownWeeks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<SyncState>('idle');
  const [error, setError] = useState<string | null>(null);
  /**
   * Why there is no week to show, when there isn't one.
   *
   * Kept apart from `error`, which reports a failed *save* while a perfectly
   * good week is on screen. These are different sentences to the user and the
   * app renders them in different places, so one string could not carry both.
   */
  const [loadError, setLoadError] = useState<string | null>(null);
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

  /* Mutations are refused until the store and the account agree.
     `store` flips to the cloud the instant sign-in resolves, but the week on
     screen is still the one built while signed out, and the load that would
     replace it is gated behind migration. Ticking a box in that gap saved the
     signed-out week into the account, straight over the real one written from
     another device — and migration then skipped that week precisely because a
     document already existed for it. */
  const readyRef = useRef(ready);
  readyRef.current = ready;

  /* Bumped by every mutation. The load effect samples it before its await and
     again after, so a week fetched across an edit is discarded instead of
     rendered over the top of it. */
  const editSeq = useRef(0);

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
    if (!ready) {
      /* Clear it rather than leaving the old store's week on screen. That week
         belongs to the session being left behind — signed-out data on the way
         in, the previous account's data on the way out — and `App` renders the
         spinner while this is null, which is what actually closes the window
         `readyRef` refuses to save into. */
      weekRef.current = null;
      setWeek(null);
      setLoadError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setLoadError(null);

    (async () => {
      const seq = editSeq.current;
      try {
        const existing = await storeRef.current.loadWeek(weekStart);
        // A week fetched across an edit is stale by definition — the edit is
        // newer than anything this response can contain, so render nothing.
        if (!active || editSeq.current !== seq) return;
        // A week you've navigated to but never touched is created in memory and
        // only persisted once you actually edit it.
        const resolved = existing ?? createWeek(weekStart, defaultsRef.current);
        weekRef.current = resolved;
        setWeek(resolved);
        setError(null);
      } catch (e) {
        if (!active || editSeq.current !== seq) return;
        /* Deliberately no fallback week.
           This used to install a blank one, so a week that merely failed to
           load rendered as 0%, 0 / 0 and "nothing planned yet" — for an app
           whose entire promise is that your week is kept, the failure mode was
           indistinguishable from having lost it. Worse, that blank week was
           live: ticking anything on it scheduled a save, and the save was a
           real one, so a transient read failure could end with an empty week
           written over the account's real one.
           Leaving it null keeps `mutate` shut (it returns early without a
           week) and lets App say what actually happened. */
        weekRef.current = null;
        setWeek(null);
        setLoadError(e instanceof Error ? e.message : 'Could not load this week.');
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [weekStart, ready, store, reloadToken]);

  /* Last week, loaded alongside this one purely to feed the empty-day
     suggestions. Failure is silent and non-blocking: no previous week simply
     means no suggestions, which is exactly right for a first-ever week. */
  useEffect(() => {
    if (!ready) {
      setPreviousWeek(null);
      return;
    }
    let active = true;
    storeRef.current
      .loadWeek(addDays(weekStart, -7))
      .then((w) => {
        if (active) setPreviousWeek(w);
      })
      .catch(() => {
        if (active) setPreviousWeek(null);
      });
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

  /* The same rollover `onShow` does, driven by the clock rather than by a
     focus event. `onShow` covers the tab you come back to; this covers the one
     you never leave. Sitting on Sunday's week at 23:59 with the window focused
     used to mean every edit after midnight was written into the week that had
     just ended. Its own `useToday` subscription keeps the hook self-contained
     — the timer is one `setTimeout`, and both copies agree by construction. */
  const clockToday = useToday();
  useEffect(() => {
    const nowWeek = currentWeekStart();
    if (nowWeek === anchorRef.current) return;
    const wasSittingOnCurrent = weekStart === anchorRef.current;
    anchorRef.current = nowWeek;
    // Only follow the calendar if you hadn't deliberately navigated away.
    if (wasSittingOnCurrent) setWeekStartRaw(nowWeek);
  }, [clockToday, weekStart]);

  /* ── Mutations ────────────────────────────────────────────────────────── */

  const mutate = useCallback(
    (fn: (w: Week) => Week) => {
      const current = weekRef.current;
      // `ready` matters as much as the week itself here: see readyRef above.
      if (!current || !readyRef.current) return;

      /* Computed before `editSeq` moves, so a mutation that turns out to be a
         no-op is free. Reconciling groups from the standing tasks runs on a
         schedule nobody asked for, and without this it would bump the edit
         sequence (discarding an in-flight load) and schedule a write on every
         pass. `fn` is pure, so running it early costs nothing. */
      const next = fn(current);
      if (next === current) return;

      editSeq.current += 1;
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
    (dayId: DayId, label = '', groupId: string | null = null) => {
      const id = uid();
      mapDay(dayId, (tasks) => [...tasks, { id, label, done: false, groupId }]);
      return id;
    },
    [mapDay],
  );

  /** Several at once, as one mutation and therefore one save. */
  const addTasks = useCallback(
    (dayId: DayId, incoming: { label: string; groupId: string | null }[]) =>
      mapDay(dayId, (tasks) => [
        ...tasks,
        ...incoming
          .map((t) => ({ ...t, label: t.label.trim() }))
          .filter((t) => t.label !== '')
          .map((t) => ({ id: uid(), label: t.label, done: false, groupId: t.groupId })),
      ]),
    [mapDay],
  );

  /**
   * Moves one task into a group, or out of every group with `null`.
   *
   * The task keeps its id, so this is a genuine re-file rather than a
   * delete-and-recreate — a checked task stays checked, and it stays exactly
   * where it was in the day's order.
   */
  const setTaskGroup = useCallback(
    (dayId: DayId, taskId: string, groupId: string | null) =>
      mapDay(dayId, (tasks) => tasks.map((t) => (t.id === taskId ? { ...t, groupId } : t))),
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
          /* Existing rows are filed before the missing ones are added. A task
             the week already holds is exactly the case "add these" used to
             skip entirely, so setting a group on a standing task did nothing
             for the routine already on the board. Filing a row is not adding
             one, so the "only ever adds" promise below is intact. */
          const existing = day.tasks.map((task) =>
            fileFromStanding(task, standingGroups(standing)),
          );
          const have = new Set(existing.map((t) => t.label.trim().toLowerCase()));
          const missing = standingTasksFor(standing, day.id)
            .map((t) => ({ ...t, label: t.label.trim() }))
            .filter((t) => t.label && !have.has(t.label.toLowerCase()))
            .map((t) => ({ id: uid(), label: t.label, done: false, groupId: t.groupId }));
          return { ...day, tasks: missing.length ? [...existing, ...missing] : existing };
        }),
      })),
    [mutate],
  );

  /**
   * Files tasks that are already on the board under the group their standing
   * task names — without adding, removing or renaming anything.
   *
   * Standing tasks are only ever seeded when a week is *created*, so a group
   * added to one afterwards reached nothing that already existed: you set the
   * mark, and the week you were looking at didn't change. That is what this
   * closes.
   *
   * Only tasks carrying no group at all are touched, so an instance you
   * deliberately re-filed somewhere else this week keeps where you put it.
   * Returns the week unchanged when there is nothing to do, which is what lets
   * `mutate` skip the write.
   */
  const applyStandingGroups = useCallback(
    (standing: StandingTask[]) =>
      mutate((w) => {
        const wanted = standingGroups(standing);
        if (wanted.size === 0) return w;

        let changed = false;
        const days = w.days.map((day) => {
          let dayChanged = false;
          const tasks = day.tasks.map((task) => {
            const filed = fileFromStanding(task, wanted);
            if (filed !== task) dayChanged = true;
            return filed;
          });
          if (!dayChanged) return day;
          changed = true;
          return { ...day, tasks };
        });
        return changed ? { ...w, days } : w;
      }),
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

  /** Re-run the load. The one way out of `loadError` without a full reload. */
  const retry = useCallback(() => setReloadToken((n) => n + 1), []);

  return {
    week,
    previousWeek,
    weekStart,
    knownWeeks,
    loading,
    sync,
    error,
    loadError,
    retry,
    goToWeek,
    toggleTask,
    setTaskLabel,
    addTask,
    addTasks,
    removeTask,
    setTaskGroup,
    setMeta,
    clearChecks,
    applyStandingTasks,
    applyStandingGroups,
    flush,
  };
}
