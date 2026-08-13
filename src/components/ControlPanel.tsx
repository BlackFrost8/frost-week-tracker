import { useEffect, useRef, useState } from 'react';
import type { Week } from '../types';

type Props = {
  week: Week;
  onSave: (patch: Pick<Week, 'focus' | 'reward' | 'affirmation'>) => void;
  onClearChecks: () => void;
};

const FIELDS = [
  { key: 'focus', label: 'focus', placeholder: 'what matters this week' },
  { key: 'reward', label: 'reward', placeholder: 'what you get for it' },
  { key: 'affirmation', label: 'affirmation', placeholder: 'why not you' },
] as const;

export function ControlPanel({ week, onSave, onClearChecks }: Props) {
  const [draft, setDraft] = useState({
    focus: week.focus,
    reward: week.reward,
    affirmation: week.affirmation,
  });
  const [confirming, setConfirming] = useState(false);
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const save = () => {
    onSave(draft);
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 620);
  };

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      confirmTimer.current = setTimeout(() => setConfirming(false), 4000);
      return;
    }
    if (confirmTimer.current) clearTimeout(confirmTimer.current);
    setConfirming(false);
    onClearChecks();
  };

  return (
    <section className="flex flex-col gap-5 lg:flex-row lg:items-end">
      <div className="grid flex-1 gap-x-8 gap-y-4 sm:grid-cols-3">
        {FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-xs text-frost-text-faint">{f.label}</span>
            <input
              className="frost-field text-sm"
              value={draft[f.key]}
              placeholder={f.placeholder}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save();
              }}
            />
          </label>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-5">
        <button
          type="button"
          onClick={clear}
          className="text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-text-dim"
        >
          {confirming ? 'clear all checks?' : 'clear'}
        </button>

        <button
          type="button"
          onClick={save}
          className={`rounded-lg px-5 py-2 text-sm transition-colors duration-150 ${
            flash ? 'frost-confirm' : ''
          }`}
          // Idle is text on nothing rather than a dead gray slab — one fewer
          // box on a screen whose whole thesis is "stop boxing things". Dirty
          // is a real block of accent, and #000 on #00efff is 14.2:1 where the
          // old #14b8c9 fill was an illegible 3.66:1.
          style={
            dirty
              ? { backgroundColor: 'var(--color-frost-cyan-200)', color: '#000000' }
              : { backgroundColor: 'transparent', color: 'var(--color-frost-cyan-300)' }
          }
        >
          {flash ? 'saved' : 'save'}
        </button>
      </div>
    </section>
  );
}
