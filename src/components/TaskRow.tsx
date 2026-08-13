import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';

type Props = {
  task: Task;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
};

export function TaskRow({ task, onToggle, onLabelChange, onDelete }: Props) {
  const isBlank = task.label.trim() === '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.label);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft aligned when the task changes underneath us (week switch,
  // cloud refresh) — but never stomp what's being typed right now.
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

  /* A blank placeholder row is always a text field — there's nothing to check
     off yet, so typing is the only sensible action. */
  if (isBlank && !editing) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
        <span
          className="h-[17px] w-[17px] shrink-0 rounded-[4px] border border-dashed"
          style={{ borderColor: 'rgba(0,229,255,0.18)' }}
          aria-hidden="true"
        />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          placeholder="Add a task…"
          aria-label="New task"
          className="w-full bg-transparent text-[13px] text-frost-text outline-none placeholder:text-frost-text-dim/50"
        />
      </div>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2.5 px-2.5 py-[7px]">
        <span
          className="h-[17px] w-[17px] shrink-0 rounded-[4px] border"
          style={{ borderColor: 'rgba(0,229,255,0.35)' }}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') cancel();
          }}
          aria-label="Edit task"
          className="w-full bg-transparent text-[13px] text-frost-cyan-bright outline-none"
        />
      </div>
    );
  }

  return (
    <div
      onClick={onToggle}
      className="group flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[7px] transition-colors duration-150 hover:bg-frost-cyan/[0.045]"
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.label}
        onClick={(e) => {
          // The row already handles the toggle; don't fire it twice.
          e.stopPropagation();
          onToggle();
        }}
        className="grid h-[17px] w-[17px] shrink-0 place-items-center rounded-[4px] border transition-all duration-150"
        style={
          task.done
            ? {
                backgroundColor: 'var(--color-frost-cyan)',
                borderColor: 'var(--color-frost-cyan)',
                boxShadow: '0 0 7px 0 rgba(0,229,255,0.6), 0 0 16px 1px rgba(0,229,255,0.22)',
              }
            : { borderColor: 'rgba(0,229,255,0.45)', backgroundColor: 'transparent' }
        }
      >
        {task.done && (
          <svg
            viewBox="0 0 12 12"
            className="frost-check-in h-[11px] w-[11px]"
            aria-hidden="true"
          >
            <path
              d="M2 6.3 L4.6 8.9 L10 3.4"
              fill="none"
              stroke="#05070a"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <span
        className={`min-w-0 flex-1 truncate text-[13px] transition-all duration-200 ${
          task.done ? 'text-frost-text-dim line-through opacity-50' : 'text-frost-text'
        }`}
        title={task.label}
      >
        {task.label}
      </span>

      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setEditing(true);
          }}
          aria-label={`Edit "${task.label}"`}
          className="grid h-5 w-5 place-items-center rounded text-frost-text-dim transition-colors hover:text-frost-cyan"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path
              d="M9.2 1.8 12.2 4.8 4.7 12.3 1.2 12.8 1.7 9.3 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
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
          aria-label={`Delete "${task.label}"`}
          className="grid h-5 w-5 place-items-center rounded text-frost-text-dim transition-colors hover:text-frost-danger"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </span>
    </div>
  );
}
