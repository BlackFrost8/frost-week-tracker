import { useEffect, useRef, useState } from 'react';
import type { Note } from '../types';
import { groupById, type TaskGroup } from '../lib/prefs';
import { GroupMenu } from './GroupMenu';
import { TaskIcon } from './TaskIcon';

type Props = {
  notes: Note[];
  onAddNote: () => string;
  onNoteChange: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  groups: TaskGroup[];
  onNoteGroupChange: (noteId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewGroup?: (noteId: string) => void;
};

function NoteRow({
  note,
  autoFocus,
  onChange,
  onDelete,
  onContinue,
  groups,
  onGroupChange,
  onRequestNewGroup,
}: {
  note: Note;
  autoFocus: boolean;
  onChange: (text: string) => void;
  onDelete: () => void;
  onContinue: () => void;
  groups: TaskGroup[];
  onGroupChange: (groupId: string | null) => void;
  onRequestNewGroup?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const group = groupById(groups, note.groupId);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  return (
    <div className="group flex items-center gap-3 py-1.5">
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: 'var(--color-frost-cyan-500)', marginInline: '6px' }}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        value={note.text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (note.text.trim() === '') onDelete();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && note.text.trim() !== '') {
            e.preventDefault();
            onContinue();
          } else if (e.key === 'Escape') {
            inputRef.current?.blur();
          }
        }}
        placeholder="Something to remember"
        aria-label="Note"
        className="min-w-0 flex-1 bg-transparent text-sm text-frost-text outline-none placeholder:text-frost-text-faint"
      />
      {group && (
        <span className="shrink-0 text-frost-cyan-300" title={group.name}>
          <TaskIcon icon={group.icon} size={14} strokeWidth={2} />
        </span>
      )}
      <span className="frost-row-tools flex shrink-0 items-center gap-1 transition-opacity duration-150">
        {/* Not on a blank note: opening the menu blurs the input, and a blank
            note deletes itself on blur. */}
        {note.text.trim() !== '' && (
          <GroupMenu
            groups={groups}
            value={note.groupId}
            onSelect={onGroupChange}
            onNewGroup={onRequestNewGroup}
            subject={note.text}
            showCurrent={false}
            className="h-6 w-6"
          />
        )}
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${note.text || 'note'}`}
          className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-alert"
        >
          <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
            <path
              d="M3 3 11 11M11 3 3 11"
              fill="none"
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

/**
 * What the day holds besides tasks: the notes you wrote. They have no
 * checkbox, and they don't count toward the day's score.
 */
export function DayCalendar({
  notes,
  onAddNote,
  onNoteChange,
  onDeleteNote,
  groups,
  onNoteGroupChange,
  onRequestNewGroup,
}: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const add = () => setFocusId(onAddNote());

  return (
    <section className="frost-divider mt-6 pt-4" aria-label="Calendar">
      <p className="text-xs text-frost-text-faint">calendar</p>

      {notes.length > 0 && (
        <div className="mt-1">
          {notes.map((note) => (
            <NoteRow
              key={note.id}
              note={note}
              autoFocus={note.id === focusId}
              onChange={(text) => onNoteChange(note.id, text)}
              onDelete={() => onDeleteNote(note.id)}
              onContinue={add}
              groups={groups}
              onGroupChange={(groupId) => onNoteGroupChange(note.id, groupId)}
              onRequestNewGroup={
                onRequestNewGroup ? () => onRequestNewGroup(note.id) : undefined
              }
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-2 flex items-center gap-3 py-1.5 text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
      >
        <span className="grid h-4 w-4 place-items-center font-mono">+</span>
        add a note
      </button>
    </section>
  );
}
