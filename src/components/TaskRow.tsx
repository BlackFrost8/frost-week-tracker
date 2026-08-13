import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';

type Props = {
  task: Task;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  /** Compact rows are used inside collapsed (non-today) days. */
  dense?: boolean;
};

export function TaskRow({ task, onToggle, onLabelChange, onDelete, dense = false }: Props) {
  const isBlank = task.label.trim() === '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(task.label);
  }, [task.label, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== task.label) onLabelChange(trimmed);
  };

  const cancel = () => {
    setDraft(task.label);
    setEditing(false);
  };

  const pad = dense ? 'py-1' : 'py-1.5';

  if ((isBlank && !editing) || editing) {
    return (
      <div className={`flex items-center gap-3 ${pad}`}>
        <span
          className="h-4 w-4 shrink-0 rounded-[3px]"
          style={{ border: '1px solid var(--frost-hairline)' }}
          aria-hidden="true"
        />
        <input
          ref={editing ? inputRef : undefined}
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
    <div
      onClick={onToggle}
      className={`group flex cursor-pointer items-center gap-3 ${pad}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.label}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        className="grid h-4 w-4 shrink-0 place-items-center rounded-[3px] transition-colors duration-150"
        style={
          task.done
            ? { backgroundColor: 'var(--color-frost-cyan-500)', border: '1px solid var(--color-frost-cyan-500)' }
            : { border: '1px solid rgba(255,255,255,0.16)', backgroundColor: 'transparent' }
        }
      >
        {task.done && (
          <svg viewBox="0 0 12 12" className="frost-check h-2.5 w-2.5" aria-hidden="true">
            <path
              d="M2 6.3 L4.6 8.9 L10 3.4"
              fill="none"
              stroke="#000000"
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

      <span className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label={`Edit ${task.label}`}
          className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-text-dim"
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
          className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-text-dim"
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
