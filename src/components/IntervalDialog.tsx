import { useCallback, useEffect, useRef, useState } from 'react';
import { useDialog } from '../hooks/useDialog';
import {
  MAX_INTERVALS,
  MAX_INTERVAL_NAME,
  makeInterval,
  type Interval,
} from '../lib/prefs';

type Props = {
  open: boolean;
  onClose: () => void;
  intervals: Interval[];
  onSave: (intervals: Interval[]) => void;
};

/** Trimmed, and the rows left blank dropped. Ids are kept: tasks point at them. */
function clean(draft: Interval[]): Interval[] {
  return draft
    .map((i) => ({ ...i, name: i.name.trim().slice(0, MAX_INTERVAL_NAME) }))
    .filter((i) => i.name !== '');
}

function Arrow({ up }: { up: boolean }) {
  return (
    <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
      <path
        d={up ? 'M2 6.5 5 3.5 8 6.5' : 'M2 3.5 5 6.5 8 3.5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const iconButton =
  'grid h-8 w-8 shrink-0 place-items-center rounded text-frost-text-faint transition-colors duration-150 disabled:opacity-30';

/**
 * The list of intervals the to-do list is divided into.
 *
 * Edited as a draft and saved as the dialog closes — every way of closing it,
 * since Escape and the backdrop both come through `close` — so renaming
 * "Morning" is one write rather than one per letter.
 */
function IntervalEditor({
  intervals,
  onSave,
  onClose,
}: {
  intervals: Interval[];
  onSave: (intervals: Interval[]) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Interval[]>(intervals);
  const [pending, setPending] = useState('');
  const addRef = useRef<HTMLInputElement>(null);

  const draftRef = useRef(draft);
  draftRef.current = draft;
  const pendingRef = useRef(pending);
  pendingRef.current = pending;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;
  const initial = useRef(intervals);

  /* On unmount, which is every close. Text left in the add field is kept, the
     same promise the standing-task editor makes: closing must not lose typing. */
  useEffect(
    () => () => {
      const typed = pendingRef.current.trim();
      const all = typed ? [...draftRef.current, makeInterval(typed)] : draftRef.current;
      const final = clean(all).slice(0, MAX_INTERVALS);
      if (JSON.stringify(final) !== JSON.stringify(initial.current)) onSaveRef.current(final);
    },
    [],
  );

  const canAdd = pending.trim() !== '' && draft.length < MAX_INTERVALS;

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canAdd) return;
    setDraft((d) => [...d, makeInterval(pending)]);
    setPending('');
    addRef.current?.focus();
  };

  const rename = (id: string, name: string) =>
    setDraft((d) => d.map((i) => (i.id === id ? { ...i, name } : i)));

  const remove = (id: string) => setDraft((d) => d.filter((i) => i.id !== id));

  const shift = (index: number, by: -1 | 1) =>
    setDraft((d) => {
      const to = index + by;
      if (to < 0 || to >= d.length) return d;
      const next = [...d];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });

  return (
    <>
      <h2 className="font-display text-lg tracking-tight text-frost-text">Intervals</h2>
      <p className="mt-1.5 text-sm text-frost-text-dim">
        The parts of your day. Each one sits under the to-do list as its own section, in this
        order.
      </p>

      {draft.length > 0 && (
        <ol className="mt-6 flex flex-col gap-2">
          {draft.map((interval, i) => (
            <li key={interval.id} className="flex items-center gap-1.5">
              <input
                value={interval.name}
                onChange={(e) => rename(interval.id, e.target.value)}
                maxLength={MAX_INTERVAL_NAME}
                aria-label={`Interval ${i + 1}`}
                className="frost-field min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => shift(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${interval.name || 'interval'} up`}
                className={`${iconButton} hover:text-frost-cyan-300`}
              >
                <Arrow up />
              </button>
              <button
                type="button"
                onClick={() => shift(i, 1)}
                disabled={i === draft.length - 1}
                aria-label={`Move ${interval.name || 'interval'} down`}
                className={`${iconButton} hover:text-frost-cyan-300`}
              >
                <Arrow up={false} />
              </button>
              <button
                type="button"
                onClick={() => remove(interval.id)}
                aria-label={`Remove ${interval.name || 'interval'}`}
                className={`${iconButton} hover:text-frost-alert`}
              >
                <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                  <path
                    d="M1.2 1.2 8.8 8.8M8.8 1.2 1.2 8.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </li>
          ))}
        </ol>
      )}

      {draft.length < MAX_INTERVALS && (
        <form
          onSubmit={add}
          className={`flex items-center gap-3 ${draft.length > 0 ? 'frost-divider mt-5 pt-5' : 'mt-6'}`}
        >
          <input
            ref={addRef}
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            maxLength={MAX_INTERVAL_NAME}
            placeholder={draft.length === 0 ? 'Morning' : 'Another interval'}
            aria-label="New interval"
            className="frost-field min-w-0 flex-1 text-sm"
          />
          <button
            type="submit"
            disabled={!canAdd}
            className={`shrink-0 rounded px-3.5 py-1.5 text-sm transition-colors duration-150 ${
              canAdd
                ? 'bg-frost-cyan-900 text-frost-cyan-200 hover:text-frost-cyan-100'
                : 'text-frost-text-faint'
            }`}
          >
            add
          </button>
        </form>
      )}

      <p className="mt-4 text-xs text-frost-text-faint">
        Removing an interval moves its tasks back to the top of the list. Nothing is deleted.
      </p>

      <button
        type="button"
        onClick={onClose}
        className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
        style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: 'var(--frost-on-accent)' }}
      >
        done
      </button>
    </>
  );
}

export function IntervalDialog({ open, onClose, intervals, onSave }: Props) {
  const close = useCallback(() => onClose(), [onClose]);
  const panelRef = useDialog(open, close);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5"
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Intervals"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        data-tour="interval-dialog"
        className="frost-rise my-auto w-full max-w-md rounded-2xl p-8 focus:outline-none"
        style={{
          backgroundColor: 'var(--color-frost-surface)',
          backgroundImage:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), rgb(var(--frost-accent-rgb) / 0) 62%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mounted only while open, so its draft starts from the saved list
            every time and its unmount is the save. */}
        <IntervalEditor intervals={intervals} onSave={onSave} onClose={close} />
      </div>
    </div>
  );
}
