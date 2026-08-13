import { useEffect, useRef, useState } from 'react';
import type { Week } from '../types';

type Props = {
  week: Week;
  onSave: (patch: Partial<Pick<Week, 'focus' | 'reward' | 'affirmation'>>) => void;
  onClearChecks: () => void;
};

const FIELDS = [
  { key: 'focus', label: 'focus', placeholder: 'what matters this week' },
  { key: 'reward', label: 'reward', placeholder: 'what you get for it' },
  { key: 'affirmation', label: 'affirmation', placeholder: 'why not you' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

/**
 * Focus, reward and affirmation are the emotional core of the product — a
 * weekly intention, a promised reward, a line of self-talk. They used to be
 * three 1px underlines in a band that was ~93% empty, i.e. the most meaningful
 * content in the app carried the least visual weight anywhere on the page.
 *
 * They now read as statements at 20px rather than as form fields, which also
 * fills the one rung of the type scale (20px) that the main view never used.
 * Click to edit; commit on Enter or blur, the same display-until-clicked
 * pattern TaskRow already uses. That also retires the Save button — everything
 * else in the app autosaves, and a Save that governed only these three fields
 * was the odd one out.
 */
export function IntentPanel({ week, onSave, onClearChecks }: Props) {
  const [editing, setEditing] = useState<FieldKey | null>(null);
  const [draft, setDraft] = useState('');
  const [confirming, setConfirming] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(
    () => () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
    },
    [],
  );

  const begin = (key: FieldKey) => {
    setDraft(week[key]);
    setEditing(key);
  };

  const commit = () => {
    if (!editing) return;
    const trimmed = draft.trim();
    if (trimmed !== week[editing]) onSave({ [editing]: trimmed });
    setEditing(null);
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
    <section className="flex flex-col gap-8" aria-label="This week">
      {FIELDS.map((f) => {
        const value = week[f.key];
        const isEditing = editing === f.key;

        return (
          <div key={f.key} className="flex flex-col gap-2">
            <span className="text-xs text-frost-text-faint">{f.label}</span>

            {isEditing ? (
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commit();
                  if (e.key === 'Escape') setEditing(null);
                }}
                aria-label={f.label}
                placeholder={f.placeholder}
                className="frost-field text-lg leading-snug"
              />
            ) : (
              <button
                type="button"
                onClick={() => begin(f.key)}
                aria-label={`Edit ${f.label}`}
                className="text-left text-lg leading-snug transition-colors duration-150"
                style={{
                  color: value ? 'var(--color-frost-text)' : 'var(--color-frost-text-faint)',
                }}
              >
                {value || f.placeholder}
              </button>
            )}
          </div>
        );
      })}

      <button
        type="button"
        onClick={clear}
        className="self-start text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-alert"
      >
        {confirming ? 'clear all checks?' : 'clear checks'}
      </button>
    </section>
  );
}
