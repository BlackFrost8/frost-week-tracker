import { useCallback, useEffect, useRef, useState } from 'react';

export type ClockMode = 'stopwatch' | 'countdown';

/**
 * Stopwatch and countdown off one timestamp.
 *
 * The value is DERIVED from `Date.now()`, never accumulated from ticks. A tick
 * counter drifts whenever the event loop is busy, and Chrome throttles
 * background-tab timers hard — so a stopwatch left running while the lid is
 * shut would come back minutes short. Here the interval only decides when to
 * re-render; subtraction decides what the number is, so a closed lid costs
 * nothing.
 */

const KEY = 'frost-week-tracker:clock:v1';
const TICK_MS = 250;
const DEFAULT_DURATION_MS = 5 * 60_000;
const MAX_DURATION_MS = 24 * 3600_000;

type Persisted = {
  mode: ClockMode;
  running: boolean;
  /** Epoch ms the current run began. `Date.now()`, not `performance.now()` —
      the latter resets to zero on every navigation, so it cannot be stored. */
  startedAt: number | null;
  /** Time banked from previous runs, in ms. */
  accumulatedMs: number;
  durationMs: number;
};

const INITIAL: Persisted = {
  mode: 'stopwatch',
  running: false,
  startedAt: null,
  accumulatedMs: 0,
  durationMs: DEFAULT_DURATION_MS,
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return INITIAL;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      mode: parsed.mode === 'countdown' ? 'countdown' : 'stopwatch',
      running: Boolean(parsed.running),
      startedAt: typeof parsed.startedAt === 'number' ? parsed.startedAt : null,
      accumulatedMs:
        typeof parsed.accumulatedMs === 'number' ? Math.max(0, parsed.accumulatedMs) : 0,
      durationMs:
        typeof parsed.durationMs === 'number' && parsed.durationMs > 0
          ? parsed.durationMs
          : DEFAULT_DURATION_MS,
    };
  } catch {
    return INITIAL;
  }
}

function elapsedOf(s: Persisted, now: number): number {
  return s.accumulatedMs + (s.running && s.startedAt !== null ? Math.max(0, now - s.startedAt) : 0);
}

export function useClock() {
  const [state, setState] = useState<Persisted>(load);
  const [now, setNow] = useState(() => Date.now());
  const [finished, setFinished] = useState(false);
  const finishedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Deliberately device-local, never synced. A timer is about the room you're
  // sitting in; syncing it would mean pausing at home stops a run at school.
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* Private mode or a full quota — the timer still works in memory. */
    }
  }, [state]);

  // Only runs while running: an idle clock costs nothing.
  useEffect(() => {
    if (!state.running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [state.running]);

  const elapsed = elapsedOf(state, now);
  const remaining = Math.max(0, state.durationMs - elapsed);
  const displayMs = state.mode === 'countdown' ? remaining : elapsed;

  // Countdown hitting zero stops itself. Checked off derived time, so it fires
  // correctly even if the tab was asleep across the whole duration.
  useEffect(() => {
    if (state.mode !== 'countdown' || !state.running || remaining > 0) return;
    setState((s) => ({ ...s, running: false, startedAt: null, accumulatedMs: s.durationMs }));
    setFinished(true);
    if (finishedTimer.current) clearTimeout(finishedTimer.current);
    finishedTimer.current = setTimeout(() => setFinished(false), 4000);
  }, [state.mode, state.running, remaining]);

  useEffect(
    () => () => {
      if (finishedTimer.current) clearTimeout(finishedTimer.current);
    },
    [],
  );

  const toggleRun = useCallback(() => {
    setFinished(false);
    setState((s) => {
      if (s.running) {
        return { ...s, running: false, startedAt: null, accumulatedMs: elapsedOf(s, Date.now()) };
      }
      // Starting a spent countdown starts it over rather than sitting at zero.
      const spent = s.mode === 'countdown' && s.accumulatedMs >= s.durationMs;
      return {
        ...s,
        running: true,
        startedAt: Date.now(),
        accumulatedMs: spent ? 0 : s.accumulatedMs,
      };
    });
  }, []);

  const reset = useCallback(() => {
    setFinished(false);
    setState((s) => ({ ...s, running: false, startedAt: null, accumulatedMs: 0 }));
  }, []);

  const setMode = useCallback((mode: ClockMode) => {
    setFinished(false);
    setState((s) => ({ ...s, mode, running: false, startedAt: null, accumulatedMs: 0 }));
  }, []);

  const addMinutes = useCallback((minutes: number) => {
    setFinished(false);
    setState((s) => ({
      ...s,
      durationMs: Math.min(MAX_DURATION_MS, Math.max(60_000, s.durationMs + minutes * 60_000)),
      accumulatedMs: 0,
      running: false,
      startedAt: null,
    }));
  }, []);

  /** Typed straight in, so a 45-minute countdown isn't 45 clicks. Floor is one
      second rather than one minute — "0:30" is a reasonable thing to want. */
  const setDuration = useCallback((ms: number) => {
    setFinished(false);
    setState((s) => ({
      ...s,
      durationMs: Math.min(MAX_DURATION_MS, Math.max(1000, Math.round(ms))),
      accumulatedMs: 0,
      running: false,
      startedAt: null,
    }));
  }, []);

  return {
    mode: state.mode,
    running: state.running,
    displayMs,
    durationMs: state.durationMs,
    dirty: elapsed > 0,
    finished,
    toggleRun,
    reset,
    setMode,
    addMinutes,
    setDuration,
  };
}

/**
 * Accepts what a person would actually type: `30` (minutes), `5:30` (m:ss),
 * `1:02:30` (h:mm:ss). Returns null for anything it can't read, so the caller
 * can leave the old value alone rather than guessing.
 */
export function parseDurationInput(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t) * 60_000;

  const parts = t.split(':');
  if (!parts.every((p) => /^\d+$/.test(p))) return null;
  if (parts.length === 2) return (Number(parts[0]) * 60 + Number(parts[1])) * 1000;
  if (parts.length === 3) {
    return (Number(parts[0]) * 3600 + Number(parts[1]) * 60 + Number(parts[2])) * 1000;
  }
  return null;
}

/** `07:42`, or `1:02:30` once an hour is on the board. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
