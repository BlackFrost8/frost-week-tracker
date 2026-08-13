import { useEffect, useRef, useState } from 'react';
import type { SyncState } from '../types';
import type { Profile } from '../hooks/useAuth';
import { addDays, currentWeekStart, fromISODate, formatLongDate } from '../lib/week';
import { Avatar } from './AccountDialog';

type Props = {
  weekStart: string;
  knownWeeks: string[];
  onGoToWeek: (weekStart: string) => void;
  sync: SyncState;
  profile: Profile | null;
  onOpenAccount: () => void;
};

/** "2026-08-10" -> "10 – 16 August" (or "28 July – 3 August" across a boundary). */
function weekRange(weekStart: string): string {
  const a = fromISODate(weekStart);
  const b = fromISODate(addDays(weekStart, 6));
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'long' });
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} – ${b.getDate()} ${month(b)}`
    : `${a.getDate()} ${month(a)} – ${b.getDate()} ${month(b)}`;
}

export function Header({
  weekStart,
  knownWeeks,
  onGoToWeek,
  sync,
  profile,
  onOpenAccount,
}: Props) {
  const thisWeek = currentWeekStart();
  const [listOpen, setListOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!listOpen) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setListOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setListOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [listOpen]);

  const weeks = Array.from(new Set([thisWeek, weekStart, ...knownWeeks])).sort().reverse();

  const arrow = (dir: -1 | 1, label: string) => (
    <button
      type="button"
      onClick={() => onGoToWeek(addDays(weekStart, dir * 7))}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded text-frost-text-faint transition-colors duration-150 hover:text-frost-text"
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
        <path
          d={dir === -1 ? 'M7.5 1.5 3 6l4.5 4.5' : 'M4.5 1.5 9 6l-4.5 4.5'}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
      {/* The one uppercase, wide-tracked element in the app (§2.3). */}
      <h1 className="font-display text-base font-medium uppercase tracking-[0.42em] text-frost-text">
        Frost
      </h1>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div ref={wrapRef} className="relative flex items-center gap-1">
          {arrow(-1, 'Previous week')}

          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-haspopup="listbox"
            className="min-w-[9.5rem] px-1 text-center font-mono text-sm text-frost-text transition-colors duration-150 hover:text-frost-cyan-300"
          >
            {weekRange(weekStart)}
          </button>

          {arrow(1, 'Next week')}

          {listOpen && (
            <div
              role="listbox"
              className="frost-rise absolute top-full left-1/2 z-30 mt-2 max-h-72 w-56 -translate-x-1/2 overflow-y-auto rounded-xl p-1.5"
              style={{ backgroundColor: 'var(--color-frost-surface-2)' }}
            >
              {weeks.map((ws) => (
                <button
                  key={ws}
                  role="option"
                  aria-selected={ws === weekStart}
                  onClick={() => {
                    onGoToWeek(ws);
                    setListOpen(false);
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left font-mono text-xs transition-colors duration-150 hover:bg-white/5"
                  style={{ color: ws === weekStart ? 'var(--color-frost-cyan-300)' : 'var(--color-frost-text-dim)' }}
                >
                  <span>{formatLongDate(ws)}</span>
                  {ws === thisWeek && <span className="text-frost-text-faint">now</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {weekStart !== thisWeek && (
          <button
            type="button"
            onClick={() => onGoToWeek(thisWeek)}
            className="text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-text-dim"
          >
            today
          </button>
        )}

        {/* Sync is a real feature, so it gets a real (tiny) affordance — and
            says nothing at all when there is nothing to report (§2.4). */}
        {sync === 'saving' && <span className="font-mono text-xs text-frost-text-faint">saving</span>}
        {/* A data-loss warning was previously rendered in cyan-700 at 2.67:1 —
            a functional bug, not a style nit. */}
        {sync === 'error' && (
          <span className="font-mono text-xs text-frost-alert">save failed</span>
        )}

        {/* The profile is one control, not two: avatar plus first name, opening
            the account card. Sign-out lives in there rather than sitting in the
            header competing for attention. */}
        {profile ? (
          <button
            type="button"
            onClick={onOpenAccount}
            className="group flex items-center gap-2.5"
            title={profile.email ?? undefined}
          >
            <Avatar profile={profile} size={26} />
            <span className="max-w-[10rem] truncate text-sm text-frost-text-dim transition-colors duration-150 group-hover:text-frost-text">
              {profile.name?.split(' ')[0] ?? profile.email}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAccount}
            className="text-sm text-frost-text-dim transition-colors duration-150 hover:text-frost-cyan-300"
          >
            sign in
          </button>
        )}
      </div>
    </header>
  );
}
