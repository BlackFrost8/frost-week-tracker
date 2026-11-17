import { useEffect, useRef, useState } from 'react';
import { intervalById, type Interval } from '../lib/prefs';
import { TaskIcon } from './TaskIcon';

type Props = {
  intervals: Interval[];
  value: string | null;
  onSelect: (intervalId: string | null) => void;
  /** What is being filed. Only ever read aloud, never shown. */
  subject: string;
  /**
   * Makes the trigger a drag handle as well as a menu.
   *
   * A press that moves past a few pixels becomes a drag and is handed to this,
   * and the click that would otherwise follow it is swallowed. A press that
   * stays put is an ordinary click and opens the menu — which is the way in
   * for a keyboard, and for anybody who would rather pick than drag.
   */
  onDragStart?: (point: { x: number; y: number }) => void;
  /**
   * Whether the trigger shows the current interval's name. On a task row the
   * section heading above already says it, so there the trigger is a grip.
   */
  showCurrent?: boolean;
  className?: string;
};

/** Six dots: the conventional "this can be picked up" mark. */
function Grip() {
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
      {[3, 6, 9].map((y) =>
        [4.2, 7.8].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />),
      )}
    </svg>
  );
}

/** How far a press has to travel before it stops being a click. */
const DRAG_SLOP = 5;

/**
 * The one control that files a task into an interval of the day.
 *
 * Shaped after `GroupMenu`, so the two read as a pair wherever they sit side
 * by side — on a task row, and on a standing task.
 */
export function IntervalMenu({
  intervals,
  value,
  onSelect,
  subject,
  onDragStart,
  showCurrent = true,
  className = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  /** Set once a press has turned into a drag, so its click is not a click. */
  const dragged = useRef(false);

  const current = intervalById(intervals, value);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      setUp(!!rect && window.innerHeight - rect.bottom < 280);
    }
    setOpen((v) => !v);
  };

  const choose = (intervalId: string | null) => {
    onSelect(intervalId);
    setOpen(false);
  };

  /* Only the primary button, and only when dragging is on offer. The listeners
     live on the window rather than the button: a finger moves faster than a
     12px target, and losing it the moment it leaves the grip would drop the
     drag before it had begun. */
  const onPointerDown = (e: React.PointerEvent) => {
    if (!onDragStart || e.button !== 0) return;
    dragged.current = false;
    const startX = e.clientX;
    const startY = e.clientY;

    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_SLOP) return;
      dragged.current = true;
      cleanup();
      setOpen(false);
      onDragStart({ x: ev.clientX, y: ev.clientY });
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  const item =
    'flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-150 hover:bg-[rgb(var(--frost-far-rgb)/0.05)]';

  const label = current ? `${subject} — in ${current.name}` : `${subject} — pick an interval`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onPointerDown={onPointerDown}
        onClick={(e) => {
          e.stopPropagation();
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          toggle();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={onDragStart ? `${label}. Drag to move it` : label}
        title={onDragStart ? 'Drag into an interval, or click to pick one' : current?.name ?? 'Interval'}
        className={`grid place-items-center rounded transition-colors duration-150 ${className}`}
        style={{
          color:
            (showCurrent && current) || open
              ? 'var(--color-frost-cyan-300)'
              : 'var(--color-frost-text-faint)',
          // Without this a touch on the grip scrolls the page instead of
          // picking the task up.
          touchAction: onDragStart ? 'none' : undefined,
          cursor: onDragStart ? 'grab' : undefined,
        }}
      >
        {onDragStart ? (
          <Grip />
        ) : showCurrent && current ? (
          <span className="max-w-[9ch] truncate px-1 text-xs">{current.name}</span>
        ) : (
          <TaskIcon icon="clock" size={15} strokeWidth={2} />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Interval for ${subject}`}
          onClick={(e) => e.stopPropagation()}
          className={`frost-rise absolute right-0 z-40 flex w-[210px] flex-col gap-0.5 rounded-xl p-1.5 ${
            up ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
          }`}
          style={{
            backgroundColor: 'var(--color-frost-surface-2)',
            border: '1px solid var(--frost-hairline)',
            boxShadow: '0 12px 28px -12px rgb(var(--frost-base-rgb) / 0.9)',
          }}
        >
          {intervals.length > 0 && (
            <div className="flex max-h-[228px] flex-col gap-0.5 overflow-y-auto">
              {intervals.map((interval) => {
                const active = interval.id === value;
                return (
                  <button
                    key={interval.id}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => choose(interval.id)}
                    className={item}
                    style={{
                      color: active ? 'var(--color-frost-cyan-200)' : 'var(--color-frost-text)',
                    }}
                  >
                    <TaskIcon icon="clock" size={15} strokeWidth={1.9} />
                    <span className="min-w-0 flex-1 truncate">{interval.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {value !== null && current && (
            <button
              type="button"
              role="menuitem"
              onClick={() => choose(null)}
              className={`${item} text-frost-text-dim`}
            >
              <span className="grid h-[15px] w-[15px] place-items-center font-mono text-xs">—</span>
              no interval
            </button>
          )}

          {intervals.length === 0 && (
            <p className="px-2.5 py-2 text-xs text-frost-text-faint">
              No intervals yet. Add them in settings.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
