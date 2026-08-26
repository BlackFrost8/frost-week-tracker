import { useEffect, useRef, useState } from 'react';
import type { Task } from '../types';
import { groupById, type TaskGroup } from '../lib/prefs';
import { GroupMenu } from './GroupMenu';
import { TaskIcon } from './TaskIcon';

type Props = {
  task: Task;
  onToggle: () => void;
  onLabelChange: (label: string) => void;
  onDelete: () => void;
  /** Every group on the account, for the picker. */
  groups: TaskGroup[];
  onGroupChange: (groupId: string | null) => void;
  /**
   * Opens the group dialog, and files this task into whatever it makes.
   * Undefined at the group cap, where the picker simply stops offering it.
   */
  onRequestNewGroup?: () => void;
  /** Compact rows are used inside collapsed (non-today) days. */
  dense?: boolean;
  /** Set on the row `+ add task` just created, so it is typable immediately. */
  autoFocus?: boolean;
  /**
   * Open another blank row after this one is filed. Enter used to commit and
   * drop focus to `<body>`, so every task after the first cost another trip to
   * `+ add task` — and on a phone that closes and reopens the keyboard between
   * every single line. Planning seven days was around fifty interactions.
   */
  onContinue?: () => void;
};

export function TaskRow({
  task,
  onToggle,
  onLabelChange,
  onDelete,
  groups,
  onGroupChange,
  onRequestNewGroup,
  dense = false,
  autoFocus = false,
  onContinue,
}: Props) {
  const isBlank = task.label.trim() === '';
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);

  const group = groupById(groups, task.groupId);

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
      <div ref={rowRef} className={`flex items-center gap-3 ${pad}`}>
        <span
          className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
          style={{ border: '1px solid rgb(var(--frost-accent-rgb) / 0.18)' }}
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          /* Committing on any blur at all would delete this row the instant
             the group button beside it was clicked — a brand-new row still has
             an empty draft, and `commit` removes those. Focus moving anywhere
             inside the row is the user still working on it, not leaving it. */
          onBlur={(e) => {
            if (rowRef.current?.contains(e.relatedTarget as Node | null)) return;
            commit();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const carriedOn = draft.trim() !== '';
              commit();
              /* Only for a row that was just added — `editing` is true only
                 when the pencil opened an existing task, and pressing Enter to
                 confirm a rename must not also append a blank row. Enter on an
                 empty row ends the run instead: `commit` has already removed
                 it, which is the natural way to stop typing a list. */
              if (!editing && carriedOn) onContinue?.();
            }
            if (e.key === 'Escape') cancel();
          }}
          placeholder="Add a task"
          aria-label={editing ? 'Edit task' : 'New task'}
          className="min-w-0 flex-1 bg-transparent text-sm text-frost-text outline-none placeholder:text-frost-text-faint"
        />

        {/* Filing happens while the task is being written, which is the moment
            you actually know what it is. Focus returns to the field afterwards
            so a row can be named and filed without touching it twice. */}
        <GroupMenu
          groups={groups}
          value={task.groupId}
          onSelect={(groupId) => {
            onGroupChange(groupId);
            inputRef.current?.focus();
          }}
          onNewGroup={onRequestNewGroup}
          subject={draft.trim() || 'this task'}
          className="h-6 w-6 shrink-0"
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
        aria-label={group ? `${task.label} — ${group.name}` : task.label}
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

      {/* Label and mark share one flexible box so the mark sits against the end
          of the text rather than being pushed to the far edge of the row —
          it is part of reading the task, not a column of its own. */}
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={`truncate text-sm transition-colors duration-150 ${
            task.done ? 'text-frost-text-faint line-through' : 'text-frost-text'
          }`}
          title={task.label}
        >
          {task.label}
        </span>

        {/* Read-only here. The group is announced as part of the checkbox's
            label above, so repeating it as an image would say it twice. */}
        {group && (
          <span
            className="shrink-0 transition-colors duration-150"
            style={{
              color: task.done
                ? 'var(--color-frost-text-faint)'
                : 'var(--color-frost-cyan-300)',
            }}
            title={group.name}
          >
            <TaskIcon icon={group.icon} size={14} strokeWidth={2} />
          </span>
        )}
      </span>

      {/* `frost-row-tools` rather than a bare `opacity-0`: transparent is not
          gone. Without the matching `pointer-events: none` these buttons kept
          their hit boxes, so on a phone — where hover never fires and so they
          never appear — there was an invisible, unconfirmed delete sitting at
          the right edge of every task row. The same rule makes them permanently
          visible wherever hovering isn't possible, since a control revealed by
          hover alone is a control a touch user cannot find at all. */}
      <span className="frost-row-tools flex shrink-0 items-center gap-1 transition-opacity duration-150">
        {/* Always the plain tag, never the group's own glyph: the mark beside
            the label already says which group this is, and a control that
            mirrors it would make one row show the same icon twice. This one is
            the verb — file it somewhere. */}
        <GroupMenu
          groups={groups}
          value={task.groupId}
          onSelect={onGroupChange}
          onNewGroup={onRequestNewGroup}
          subject={task.label}
          showCurrent={false}
          className="h-6 w-6"
        />

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
