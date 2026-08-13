import type { StorageKind, SyncState } from '../types';
import { addDays, currentWeekStart, formatLongDate } from '../lib/week';

type Props = {
  weekStart: string;
  knownWeeks: string[];
  onGoToWeek: (weekStart: string) => void;
  sync: SyncState;
  storageKind: StorageKind;
  email: string | null;
  onSignOut: () => void;
  onOpenAccount: () => void;
};

function SyncBadge({ sync, storageKind }: { sync: SyncState; storageKind: StorageKind }) {
  const cloud = storageKind === 'cloud';

  const { text, color } =
    sync === 'saving'
      ? { text: 'Saving', color: 'var(--color-frost-cyan)' }
      : sync === 'error'
        ? { text: 'Save failed', color: 'var(--color-frost-danger)' }
        : sync === 'saved'
          ? { text: cloud ? 'Synced' : 'Saved', color: 'var(--color-frost-cyan-bright)' }
          : { text: cloud ? 'Cloud' : 'This device', color: 'var(--color-frost-text-dim)' };

  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em]"
      style={{ color }}
      role="status"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${sync === 'saving' ? 'frost-pulse' : ''}`}
        style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
      />
      {text}
    </span>
  );
}

export function Header({
  weekStart,
  knownWeeks,
  onGoToWeek,
  sync,
  storageKind,
  email,
  onSignOut,
  onOpenAccount,
}: Props) {
  const thisWeek = currentWeekStart();
  // Always offer the current week plus everything already saved.
  const options = Array.from(new Set([thisWeek, weekStart, ...knownWeeks])).sort().reverse();

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-baseline gap-3">
        <h1 className="font-display text-base font-semibold uppercase tracking-[0.3em] text-frost-cyan frost-glow-text sm:text-lg">
          Frost
        </h1>
        <span className="font-display text-[11px] uppercase tracking-[0.28em] text-frost-text-dim">
          // Week Tracker
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SyncBadge sync={sync} storageKind={storageKind} />

        <div className="mx-1 hidden h-5 w-px bg-frost-cyan/15 sm:block" />

        <button
          type="button"
          onClick={() => onGoToWeek(addDays(weekStart, -7))}
          aria-label="Previous week"
          className="grid h-8 w-8 place-items-center rounded-lg border text-frost-text-dim transition-colors hover:border-frost-cyan/40 hover:text-frost-cyan"
          style={{ borderColor: 'var(--frost-border)' }}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M7.5 1.5 3 6l4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <select
          className="frost-input frost-select cursor-pointer px-3 py-1.5 font-mono text-xs"
          value={weekStart}
          onChange={(e) => onGoToWeek(e.target.value)}
          aria-label="Select week"
        >
          {options.map((ws) => (
            <option key={ws} value={ws}>
              {formatLongDate(ws)}
              {ws === thisWeek ? '  •  this week' : ''}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onGoToWeek(addDays(weekStart, 7))}
          aria-label="Next week"
          className="grid h-8 w-8 place-items-center rounded-lg border text-frost-text-dim transition-colors hover:border-frost-cyan/40 hover:text-frost-cyan"
          style={{ borderColor: 'var(--frost-border)' }}
        >
          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
            <path
              d="M4.5 1.5 9 6l-4.5 4.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {weekStart !== thisWeek && (
          <button
            type="button"
            onClick={() => onGoToWeek(thisWeek)}
            className="rounded-lg border px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.15em] text-frost-text-dim transition-colors hover:border-frost-cyan/40 hover:text-frost-cyan"
            style={{ borderColor: 'var(--frost-border)' }}
          >
            Today
          </button>
        )}

        <div className="mx-1 hidden h-5 w-px bg-frost-cyan/15 sm:block" />

        {email ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAccount}
              className="max-w-[160px] truncate rounded-lg border px-3 py-1.5 font-mono text-[11px] text-frost-text-dim transition-colors hover:border-frost-cyan/40 hover:text-frost-cyan"
              style={{ borderColor: 'var(--frost-border)' }}
              title={email}
            >
              {email}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-lg border px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.15em] text-frost-text-dim transition-colors hover:border-frost-danger/50 hover:text-frost-danger"
              style={{ borderColor: 'var(--frost-border)' }}
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAccount}
            className="rounded-lg border px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.15em] text-frost-cyan transition-colors hover:border-frost-cyan/50"
            style={{ borderColor: 'rgba(0,229,255,0.28)' }}
          >
            Sync across devices
          </button>
        )}
      </div>
    </header>
  );
}
