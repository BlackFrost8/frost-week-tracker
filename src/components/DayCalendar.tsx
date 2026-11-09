import { useEffect, useRef, useState } from 'react';
import type { Note } from '../types';
import { sinceText, type CalendarEvent } from '../lib/gcal';
import { groupById, type TaskGroup } from '../lib/prefs';
import { GroupMenu } from './GroupMenu';
import { TaskIcon } from './TaskIcon';

/** Past a day old, an import is worth mentioning where the events are read. */
const STALE_MS = 24 * 60 * 60_000;

type Props = {
  notes: Note[];
  /** Imported from Google Calendar for this date; read-only here. */
  events: CalendarEvent[];
  onAddNote: () => string;
  onNoteChange: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  groups: TaskGroup[];
  onNoteGroupChange: (noteId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewGroup?: (noteId: string) => void;
  /** When the connected calendar was last imported; null when not connected. */
  importedAt: string | null;
  importing: boolean;
  /** From a click: may open Google's popup when the tab holds no token. */
  onRefresh: () => void;
};

/** "14:05" in the reader's own clock — 2:05 pm where that is the habit. */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

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
 * What the day holds besides tasks: notes you wrote, and events brought in
 * from Google Calendar. Neither has a checkbox, and neither counts toward the
 * day's score.
 */
export function DayCalendar({
  notes,
  events,
  onAddNote,
  onNoteChange,
  onDeleteNote,
  groups,
  onNoteGroupChange,
  onRequestNewGroup,
  importedAt,
  importing,
  onRefresh,
}: Props) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const add = () => setFocusId(onAddNote());

  /* The import only refreshes on its own while the tab holds Google's
     hour-long token. After that the events stood still until somebody went
     into settings, and the only sign of their age was a faint line in there —
     so a moved meeting kept showing at its old time with nothing saying so. */
  const stale = importedAt !== null && Date.now() - Date.parse(importedAt) > STALE_MS;

  return (
    <section className="frost-divider mt-6 pt-4" aria-label="Calendar">
      <p className="text-xs text-frost-text-faint">calendar</p>

      {stale && (
        <p className="mt-2 text-xs text-frost-text-dim">
          imported {sinceText(importedAt)}
          <span className="mx-2 text-frost-text-faint">·</span>
          <button
            type="button"
            onClick={onRefresh}
            disabled={importing}
            className="text-frost-cyan-300 transition-colors hover:text-frost-cyan-100 disabled:opacity-50"
          >
            {importing ? 'importing…' : 'refresh'}
          </button>
        </p>
      )}

      {events.length > 0 && (
        <ul className="mt-2 flex flex-col">
          {events.map((event) => (
            <li key={event.id} className="flex items-baseline gap-3 py-1.5 text-sm">
              <span className="w-[4.5rem] shrink-0 font-mono text-xs text-frost-cyan-300">
                {event.time ? formatTime(event.time) : event.ongoing ? 'ongoing' : 'all day'}
              </span>
              <span className="min-w-0 flex-1 truncate text-frost-text-dim" title={event.title}>
                {event.title}
              </span>
            </li>
          ))}
        </ul>
      )}

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
