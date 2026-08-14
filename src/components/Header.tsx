import { useEffect, useRef, useState } from 'react';
import type { SyncState } from '../types';
import type { Profile } from '../hooks/useAuth';
import { addDays, currentWeekStart, fromISODate, formatLongDate } from '../lib/week';
import { Avatar } from './AccountDialog';
import { Clock } from './Clock';

type Props = {
  weekStart: string;
  knownWeeks: string[];
  onGoToWeek: (weekStart: string) => void;
  sync: SyncState;
  profile: Profile | null;
  avatar: string | null;
  onOpenAccount: () => void;
  onOpenTheme: () => void;
  wordmark: string;
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
  avatar,
  onOpenAccount,
  onOpenTheme,
  wordmark,
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
      className="grid h-7 w-7 place-items-center rounded text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-200"
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
      {/* The one uppercase, wide-tracked element in the app (§2.3). It is also
          the theme control — the wordmark is the app's identity, so putting
          "change how this looks" behind it needs no extra chrome in a header
          that is deliberately sparse. */}
      {/* `uppercase` sits on the button, not the h1: a button does not inherit
          text-transform, so on the h1 it silently did nothing. Keeping it on
          exactly one element also keeps the §6 uppercase count at 1. */}
      <h1 className="font-wordmark text-base">
        <button
          type="button"
          onClick={onOpenTheme}
          className="frost-wordmark uppercase"
          aria-haspopup="dialog"
          title="Change the theme"
          // Michroma is already a wide face, so the old 0.42em would push a
          // five-letter mark halfway across the header. Longer custom names
          // tighten further rather than wrapping.
          style={{ letterSpacing: wordmark.length > 8 ? '0.16em' : '0.28em' }}
        >
          {wordmark}
        </button>
      </h1>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <Clock />

        <div ref={wrapRef} className="relative flex items-center gap-1">
          {arrow(-1, 'Previous week')}

          <button
            type="button"
            onClick={() => setListOpen((v) => !v)}
            aria-expanded={listOpen}
            aria-haspopup="listbox"
            className="min-w-[9.5rem] px-1 text-center font-mono text-sm text-frost-cyan-100 transition-colors duration-150 hover:text-frost-cyan-050"
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
            className="text-sm text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-200"
          >
            today
          </button>
        )}

        {/* Sync is a real feature, so it gets a real (tiny) affordance — and
            says nothing at all when there is nothing to report (§2.4). */}
        {sync === 'saving' && <span className="font-mono text-xs text-frost-cyan-500">saving</span>}
        {/* A data-loss warning was previously rendered in cyan-700 at 2.67:1 —
            a functional bug, not a style nit. */}
        {sync === 'error' && (
          <span className="font-mono text-xs text-frost-alert">save failed</span>
        )}

        {/* The picture is the whole control. A name or an address next to it
            said nothing you don't already know — you are the one signed in —
            and an email address is the last thing that should sit permanently
            on screen in a room, a screenshot or a shared display. Everything
            about the account lives one click in, where it is being asked for.
            28px rather than 26: it is now the only thing to aim at. */}
        {profile ? (
          <button
            type="button"
            onClick={onOpenAccount}
            aria-label="Account"
            title="Account"
            className="rounded-full transition-opacity duration-150 hover:opacity-75"
          >
            <Avatar profile={profile} src={avatar ?? profile.avatarUrl} size={28} />
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenAccount}
            className="text-sm text-frost-cyan-300 transition-colors duration-150 hover:text-frost-cyan-100"
          >
            sign in
          </button>
        )}
      </div>
    </header>
  );
}
