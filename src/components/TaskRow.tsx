import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';

type Props = {
  task: Task;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  /** Compact rows are used inside collapsed (non-today) days. */
  dense?: boolean;
  /** Set on the row `+ add task` just created, so it is typable immediately. */
  autoFocus?: boolean;
};

export function TaskRow({
  task,
  onToggle,
  onLabelChange,
  onDelete,
  dense = false,
  autoFocus = false,
}: Props) {
  const isBlank = task.label.trim() === '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // A one-shot pop when the box becomes checked. Checking a task is the core
  // verb of the app and used to produce less feedback than saving the metadata
  // form next to it.
  const [popping, setPopping] = useState(false);
  const prevDone = useRef(task.done);
  useEffect(() => {
    if (task.done && !prevDone.current) {
      setPopping(true);
      const t = setTimeout(() => setPopping(false), 190);
      prevDone.current = task.done;
      return () => clearTimeout(t);
    }
    prevDone.current = task.done;
  }, [task.done]);

  useEffect(() => {
    if (!editing) setDraft(task.label);
  }, [task.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    // Emptying a row removes it rather than leaving an inert blank behind —
    // blanks have no delete affordance of their own, so they used to be
    // unremovable once created. This also gives `+ add task` a natural cancel:
    // click it, click away without typing, the row goes.
    if (trimmed === '') {
      onDelete();
      return;
    }
    if (trimmed !== task.label) onLabelChange(trimmed);
  };

  const cancel = () => {
    setDraft(task.label);
    setEditing(false);
    if (task.label.trim() === '') onDelete();
  };

  const pad = dense ? 'py-1' : 'py-1.5';

  if ((isBlank && !editing) || editing) {
    return (
      <div className={`flex items-center gap-3 ${pad}`}>
        <span
          className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
          style={{ border: '1px solid rgb(var(--frost-accent-rgb) / 0.18)' }}
          aria-hidden="true"
        />
        <input
          ref={editing ? inputRef : undefined}
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="Add a task"
          aria-label={editing ? 'Edit task' : 'New task'}
          className="w-full bg-transparent text-sm text-frost-text outline-none placeholder:text-frost-text-faint"
        />
      </div>
    );
  }

  return (
    <div onClick={onToggle} className={`group flex cursor-pointer items-center gap-3 ${pad}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.label}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] transition-colors duration-150 ${
          popping ? 'frost-pop' : ''
        }`}
        // Checked boxes are the app's largest source of colour, and they earn
        // it — the screen literally saturates as the week gets done. A flat
        // fill spends nothing from the glow budget: it is chroma, not light.
        style={
          task.done
            ? {
                backgroundColor: 'var(--color-frost-cyan-200)',
                border: '1px solid var(--color-frost-cyan-200)',
              }
            : { border: '1px solid rgb(var(--frost-accent-rgb) / 0.22)', backgroundColor: 'rgb(var(--frost-accent-rgb) / 0.03)' }
        }
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="frost-check h-2.5 w-2.5" aria-hidden="true">
            <path
              d="M2 6.3 L4.6 8.9 L10 3.4"
              fill="none"
              stroke="var(--frost-on-accent)"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <span
        className={`min-w-0 flex-1 truncate text-sm transition-colors duration-150 ${
          task.done ? 'text-frost-text-faint line-through' : 'text-frost-text'
        }`}
        title={task.label}
      >
        {task.label}
      </span>

      {/* `frost-row-tools` rather than a bare `opacity-0`: transparent is not
          gone. Without the matching `pointer-events: none` these buttons kept
          their hit boxes, so on a phone — where hover never fires and so they
          never appear — there was an invisible, unconfirmed delete sitting at
          the right edge of every task row. The same rule makes them permanently
          visible wherever hovering isn't possible, since a control revealed by
          hover alone is a control a touch user cannot find at all. */}
      <span className="frost-row-tools flex shrink-0 items-center gap-1 transition-opacity duration-150">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label={`Edit ${task.label}`}
          className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-cyan-300"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path
              d="M9.2 1.8 12.2 4.8 4.7 12.3 1.2 12.8 1.7 9.3 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${task.label}`}
          className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-alert"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </span>
    </div>
  );
}
