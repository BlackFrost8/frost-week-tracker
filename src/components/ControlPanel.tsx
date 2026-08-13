import { useEffect, useRef, useState } from 'react';
import type { Week } from '../types';

type Props = {
  week: Week;
  onSave: (patch: Pick<Week, 'focus' | 'reward' | 'affirmation'>) => void;
  onClearChecks: () => void;
};

const FIELDS = [
  { key: 'focus', label: 'Weekly Focus', placeholder: 'e.g. Work on nutrition' },
  { key: 'reward', label: 'Reward', placeholder: 'e.g. Cheat meal' },
  { key: 'affirmation', label: 'Affirmation', placeholder: 'e.g. Why not you?' },
] as const;

export function ControlPanel({ week, onSave, onClearChecks }: Props) {
  const [draft, setDraft] = useState({
    focus: week.focus,
    reward: week.reward,
    affirmation: week.affirmation,
  });
  const [flash, setFlash] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the draft when a different week loads.
  useEffect(() => {
    setDraft({ focus: week.focus, reward: week.reward, affirmation: week.affirmation });
  }, [week.weekStart, week.focus, week.reward, week.affirmation]);

  useEffect(
    () => () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const dirty =
    draft.focus !== week.focus ||
    draft.reward !== week.reward ||
    draft.affirmation !== week.affirmation;

  const handleSave = () => {
    onSave(draft);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 2000);
  };

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true);
      // Auto-disarm so a stray click can't sit there primed.
      confirmTimer.current = setTimeout(() => setConfirmingClear(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirmingClear(false);
    onClearChecks();
  };

  return (
    <section className="frost-panel flex flex-col gap-4 p-4 lg:flex-row lg:items-end">
      <div className="grid flex-1 gap-3 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="font-display text-[10px] uppercase tracking-[0.22em] text-frost-text-dim">
              {field.label}
            </span>
            <input
              className="frost-input px-3 py-2 text-sm"
              value={draft[field.key]}
              placeholder={field.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [field.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
            />
          </label>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {flash && (
          <span
            className="font-mono text-[11px] uppercase tracking-widest text-frost-cyan-bright"
            role="status"
          >
            Saved
          </span>
        )}

        <button
          type="button"
          onClick={handleSave}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.15em] transition-all duration-150 ${
            dirty ? 'frost-pulse' : 'frost-glow'
          }`}
          style={{
            backgroundColor: 'var(--color-frost-cyan)',
            color: '#04141a',
          }}
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M1.6 1.6h8l2.8 2.8v8H1.6z M4.2 1.6h5.2v3.4H4.2z M3.6 8h6.8v4.4H3.6z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
          Save
        </button>

        <button
          type="button"
          onClick={handleClear}
          onBlur={() => setConfirmingClear(false)}
          className="flex items-center gap-2 rounded-lg border px-4 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.15em] transition-all duration-150"
          style={{
            borderColor: confirmingClear ? 'var(--color-frost-danger)' : 'rgba(255,84,112,0.3)',
            color: confirmingClear ? 'var(--color-frost-danger)' : 'var(--color-frost-text-dim)',
            backgroundColor: confirmingClear ? 'rgba(255,84,112,0.08)' : 'transparent',
          }}
        >
          <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          {confirmingClear ? 'Sure?' : 'Clear'}
        </button>
      </div>
    </section>
  );
}
