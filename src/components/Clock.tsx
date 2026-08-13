import { useEffect, useState } from 'react';
import { formatDuration, useClock } from '../hooks/useClock';

/** Ticks on the minute boundary rather than every second — a wall clock that
    only shows hours and minutes has nothing to say in between. */
function useWallClock(): string {
  const [text, setText] = useState(() =>
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  );

  useEffect(() => {
    let id: ReturnType<typeof setTimeout>;
    const schedule = () => {
      const now = new Date();
      setText(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      id = setTimeout(schedule, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()));
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  return text;
}

const quiet =
  'text-xs text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300';

export function Clock() {
  const wall = useWallClock();
  const { mode, running, displayMs, dirty, finished, toggleRun, reset, setMode, addMinutes } =
    useClock();

  const countdown = mode === 'countdown';

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-sm tabular-nums text-frost-text-dim" title="current time">
        {wall}
      </span>

      <span
        className="h-3 w-px"
        style={{ backgroundColor: 'var(--frost-hairline)' }}
        aria-hidden="true"
      />

      <button
        type="button"
        onClick={toggleRun}
        aria-label={running ? 'Pause' : 'Start'}
        // The finish flash reuses the existing one-shot confirm glow rather
        // than introducing another glow site.
        className={`rounded px-1 font-mono text-sm tabular-nums transition-colors duration-150 ${
          finished ? 'frost-confirm' : ''
        }`}
        style={{
          color: running
            ? 'var(--color-frost-cyan-200)'
            : dirty
              ? 'var(--color-frost-text)'
              : 'var(--color-frost-text-dim)',
        }}
      >
        {formatDuration(displayMs)}
      </button>

      {countdown && !running && (
        <span className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => addMinutes(-1)}
            className={quiet}
            aria-label="One minute less"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => addMinutes(1)}
            className={quiet}
            aria-label="One minute more"
          >
            +
          </button>
        </span>
      )}

      {dirty && !running && (
        <button type="button" onClick={reset} className={quiet}>
          reset
        </button>
      )}

      {/* aria-pressed, not aria-expanded: this is a two-state mode switch, and
          aria-expanded is already doing other work in this header. */}
      <button
        type="button"
        onClick={() => setMode(countdown ? 'stopwatch' : 'countdown')}
        aria-pressed={countdown}
        className={quiet}
        title="Switch between counting up and counting down"
      >
        {countdown ? 'countdown' : 'timer'}
      </button>

      {/* Silent until something actually happens — never narrates the seconds. */}
      <span className="sr-only" role="status" aria-live="polite">
        {finished ? 'Countdown finished.' : ''}
      </span>
    </div>
  );
}
