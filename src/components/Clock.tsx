import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatDuration, parseDurationInput, useClock } from '../hooks/useClock';

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

/* The header cluster runs on the accent ramp rather than the grey tiers, with
   hierarchy carried by how far down the ramp each control sits: 500 for the
   quiet verbs, 300 for the wall clock, 100/200 for the numbers you actually
   read. Grey here read as disabled chrome next to the coloured week nav. */
/* The vertical padding is not decoration: without it the hit box is the glyph
   itself — roughly 10px for "±1" or the expand icon — which is a coin-flip to
   tap on a phone. The negative margin keeps the row's visual spacing exactly
   where it was, so the targets grow without the header growing with them. */
const quiet =
  '-my-2 py-2 text-xs text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-200';

function ExpandIcon() {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
      <path
        d="M1 3.4V1h2.4M6.6 1H9v2.4M9 6.6V9H6.6M3.4 9H1V6.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 10 10" className="h-3 w-3" aria-hidden="true">
      <path
        d="M1.2 1.2 8.8 8.8M8.8 1.2 1.2 8.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Clock() {
  const wall = useWallClock();
  const {
    mode,
    running,
    displayMs,
    durationMs,
    dirty,
    finished,
    toggleRun,
    reset,
    setMode,
    addMinutes,
    setDuration,
  } = useClock();

  const countdown = mode === 'countdown';

  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /** A double-click also fires two clicks. Without this, opening the editor
      would start and immediately pause the countdown on the way past. */
  const singleClick = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (singleClick.current) clearTimeout(singleClick.current);
    };
  }, []);

  useEffect(() => {
    if (!editing) return;
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [editing]);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !editing) setExpanded(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [expanded, editing]);

  const beginEdit = () => {
    if (!countdown) return;
    setDraft(formatDuration(durationMs));
    setEditing(true);
  };

  const commitEdit = () => {
    const parsed = parseDurationInput(draft);
    if (parsed !== null) setDuration(parsed);
    setEditing(false);
  };

  const onDigitsClick = () => {
    // Stopwatch has no duration to edit, so it never needs the delay.
    if (!countdown) {
      toggleRun();
      return;
    }
    if (singleClick.current) return;
    singleClick.current = setTimeout(() => {
      singleClick.current = null;
      toggleRun();
    }, 220);
  };

  const onDigitsDoubleClick = () => {
    if (singleClick.current) {
      clearTimeout(singleClick.current);
      singleClick.current = null;
    }
    beginEdit();
  };

  /** Idle digits are deliberately quiet inline, where they sit next to the week
      nav and shouldn't compete. In the focus view they're the only thing on
      screen, so the dim tone just reads as washed out — full text there. */
  const digitsColour = (big: boolean) =>
    running
      ? 'var(--color-frost-cyan-200)'
      : big || dirty
        ? 'var(--color-frost-cyan-050)'
        : 'var(--color-frost-cyan-100)';

  /** The digits, at whichever size the surface calls for. */
  const face = (big: boolean) => {
    const sizing = big
      ? { fontSize: 'clamp(64px, 15vw, 200px)', lineHeight: 1 }
      : { fontSize: '14px' };

    if (editing) {
      return (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitEdit();
            if (e.key === 'Escape') {
              e.stopPropagation();
              setEditing(false);
            }
          }}
          inputMode="numeric"
          aria-label="Countdown length — minutes, or m:ss"
          className={`bg-transparent text-center font-mono tabular-nums outline-none ${
            big ? 'w-full' : 'w-[5.5ch]'
          }`}
          style={{
            ...sizing,
            color: 'var(--color-frost-cyan-200)',
            borderBottom: '1px solid var(--color-frost-cyan-300)',
          }}
        />
      );
    }

    return (
      <button
        type="button"
        onClick={onDigitsClick}
        onDoubleClick={onDigitsDoubleClick}
        aria-label={running ? 'Pause' : 'Start'}
        title={countdown ? 'Click to start, double-click to set the length' : undefined}
        // The finish flash reuses the existing one-shot confirm glow rather
        // than introducing another glow site.
        className={`rounded px-1 font-mono tabular-nums transition-colors duration-150 ${
          finished ? 'frost-confirm' : ''
        }`}
        style={{ ...sizing, color: digitsColour(big) }}
      >
        {formatDuration(displayMs)}
      </button>
    );
  };

  const controls = (
    <>
      {countdown && !running && !editing && (
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
    </>
  );

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-sm tabular-nums text-frost-cyan-300" title="current time">
        {wall}
      </span>

      <span
        className="h-3 w-px"
        style={{ backgroundColor: 'var(--frost-hairline)' }}
        aria-hidden="true"
      />

      {face(false)}
      {controls}

      <button
        type="button"
        onClick={() => setExpanded(true)}
        className={quiet}
        aria-label="Show the timer full screen"
        title="Show the timer full screen"
      >
        <ExpandIcon />
      </button>

      {/* Silent until something actually happens — never narrates the seconds. */}
      <span className="sr-only" role="status" aria-live="polite">
        {finished ? 'Countdown finished.' : ''}
      </span>

      {/* Portalled to the body so the overlay isn't trapped inside the shell's
          z-10 stacking context, and so its blur applies to the whole page. */}
      {expanded &&
        createPortal(
          <div
            className="frost-rise fixed inset-0 z-[60] grid place-items-center"
            style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(14px)' }}
            role="dialog"
            aria-modal="true"
            aria-label="Timer"
          >
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="absolute top-6 right-6 p-2 text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
              aria-label="Minimise the timer"
              title="Minimise"
            >
              <CloseIcon />
            </button>

            <div className="flex w-full max-w-[92vw] flex-col items-center gap-8">
              {face(true)}
              <div className="flex items-center gap-5">{controls}</div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
