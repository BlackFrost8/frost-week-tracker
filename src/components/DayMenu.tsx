import { useEffect, useRef, useState } from 'react';
import type { Day, DayId } from '../types';
import { DAY_LABELS, totalCount } from '../lib/week';

type Props = {
  /** The days this task can go to. The day it is already on is not among them. */
  days: Day[];
  onSelect: (dayId: DayId) => void;
  /** What is being moved. Only ever read aloud, never shown. */
  subject: string;
  /** Extra classes for the trigger, so it can match the row it sits in. */
  className?: string;
};

/** Move-to: a line ending in an arrowhead, stopped against the day it lands on. */
function MoveIcon() {
  return (
    <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
      <path
        d="M2 7h6.4M6.6 4.6 9 7l-2.4 2.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M11.4 2.6v8.8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Sends one task to another day of the same week.
 *
 * Planning is not done in the order it happens: a thing written on Monday
 * turns out to belong to Thursday. Saying so used to mean deleting the row and
 * typing it again on the other day, which loses its group and its checkmark.
 *
 * A menu rather than a drag: the seven days are a fixed, named set, only one
 * of them is on screen at a time, and dragging is the one gesture that does
 * not survive a phone.
 */
export function DayMenu({ days, onSelect, subject, className = '' }: Props) {
  const [open, setOpen] = useState(false);
  /* Same rule as the group picker: a row near the bottom of the viewport
     opens upward, or the menu unfolds into the fold with nothing below it. */
  const [up, setUp] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    /* `pointerdown`, not `click`: see GroupMenu. A click listener fires after
       the mousedown has already blurred the row's edit field, which commits
       and unmounts the row before the selection can land. */
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

  if (days.length === 0) return null;

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      // 40px a row plus the heading and the padding around them.
      const needed = days.length * 40 + 46;
      setUp(!!rect && window.innerHeight - rect.bottom < needed);
    }
    setOpen((v) => !v);
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Move ${subject} to another day`}
        title="Move to another day"
        /* Classes rather than an inline colour, so the row's hover state can
           reach it. An inline `style.color` outranks every utility. */
        className={`grid place-items-center rounded transition-colors duration-150 hover:text-frost-cyan-300 ${
          open ? 'text-frost-cyan-300' : 'text-frost-text-faint'
        } ${className}`}
      >
        <MoveIcon />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={`Move ${subject} to`}
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
          <p className="px-2.5 pt-1 pb-1.5 text-xs text-frost-text-faint">move to</p>

          {days.map((day) => {
            const total = totalCount(day);
            return (
              <button
                key={day.id}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onSelect(day.id);
                }}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm text-frost-text transition-colors duration-150 hover:bg-[rgb(var(--frost-far-rgb)/0.05)]"
              >
                <span className="min-w-0 flex-1 truncate">{DAY_LABELS[day.id]}</span>
                {/* How loaded that day already is, so the choice can be made
                    without first going to look at where the task is going. */}
                <span className="shrink-0 font-mono text-xs text-frost-text-faint">
                  {total > 0 ? total : '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
