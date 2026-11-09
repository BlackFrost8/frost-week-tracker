import { useState } from 'react';
import type { Day, DayId } from '../types';
import type { TaskGroup } from '../lib/prefs';
import type { CalendarEvent } from '../lib/gcal';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { DayCalendar } from './DayCalendar';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  isToday: boolean;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => string;
  groups: TaskGroup[];
  onGroupChange: (taskId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewGroup?: (taskId: string) => void;
  /** Every day of the week, so a task can be sent to one of the other six. */
  days: Day[];
  onMoveTask: (taskId: string, toDayId: DayId) => void;
  /** Google Calendar events on this date. */
  events: CalendarEvent[];
  onAddNote: () => string;
  onNoteChange: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  onNoteGroupChange: (noteId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewNoteGroup?: (noteId: string) => void;
  /** When the connected calendar was last imported; null when not connected. */
  calendarImportedAt: string | null;
  calendarImporting: boolean;
  onRefreshCalendar: () => void;
};

/**
 * The focal card. Always present — it shows whichever day the strip has
 * selected, which is what gives the layout one place to look, one text measure
 * for every task, and a working screen on a week that doesn't contain today
 * (previously that state rendered no card at all).
 *
 * The glow still belongs to today and only to today (§2.4): selecting another
 * day gets you the surface without the light.
 */
export function DayCard({
  day,
  isToday,
  onToggle,
  onLabelChange,
  onDelete,
  onAdd,
  groups,
  onGroupChange,
  onRequestNewGroup,
  days,
  onMoveTask,
  events,
  onAddNote,
  onNoteChange,
  onDeleteNote,
  onNoteGroupChange,
  onRequestNewNoteGroup,
  calendarImportedAt,
  calendarImporting,
  onRefreshCalendar,
}: Props) {
  const done = completedCount(day);
  const left = leftCount(day);
  const [focusId, setFocusId] = useState<string | null>(null);
  const isEmpty = day.tasks.length === 0;

  // Computed once for the whole list rather than per row: the day a task is
  // already on is not a place it can be moved to.
  const moveTargets = days.filter((d) => d.id !== day.id);

  return (
    <section
      // The tour lights this, not the grid cell around it: that cell spans
      // three rows and is as tall as the whole right-hand column.
      data-tour="day"
      className={`frost-rise rounded-2xl p-6 sm:p-8 ${isToday ? 'frost-today-glow' : ''}`}
      style={{
        background: isToday
          ? 'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), rgb(var(--frost-base-rgb) / 0.9) 62%)'
          : 'rgb(var(--frost-base-rgb) / 0.72)',
      }}
      aria-label={isToday ? `Today, ${day.label}` : day.label}
    >
      {/* One wrapper at the reading measure, so header, list and footer share a
          single right edge instead of the header running 109px past the rest. */}
      <div className="max-w-[54ch]">
        <header className="flex items-baseline justify-between gap-4">
          <div>
            <p
              className="text-xs"
              style={{
                color: isToday
                  ? 'var(--color-frost-cyan-200)'
                  : 'var(--color-frost-text-faint)',
              }}
            >
              {isToday ? 'today' : 'selected'}
            </p>
            <h2 className="mt-1 font-display text-2xl leading-none tracking-tight text-frost-text">
              {day.label}
            </h2>
          </div>
          <p className="font-mono text-sm text-frost-text-dim">{longDayDate(day.date)}</p>
        </header>

        <div className="frost-divider mt-6 pt-2">
          {day.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              autoFocus={task.id === focusId}
              onToggle={() => onToggle(task.id)}
              onLabelChange={(label) => onLabelChange(task.id, label)}
              onDelete={() => onDelete(task.id)}
              groups={groups}
              onGroupChange={(groupId) => onGroupChange(task.id, groupId)}
              onRequestNewGroup={
                onRequestNewGroup ? () => onRequestNewGroup(task.id) : undefined
              }
              moveTargets={moveTargets}
              onMove={(toDayId) => onMoveTask(task.id, toDayId)}
              onContinue={() => setFocusId(onAdd())}
            />
          ))}

          {isEmpty && (
            <p className="py-2 text-sm text-frost-text-faint">nothing planned yet</p>
          )}

          <button
            type="button"
            onClick={() => setFocusId(onAdd())}
            className="mt-2 flex items-center gap-3 py-1.5 text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
          >
            <span className="grid h-4 w-4 place-items-center font-mono">+</span>
            add task
          </button>
        </div>

        <footer className="frost-divider mt-5 pt-4">
          <p className="font-mono text-sm text-frost-text-dim">
            <span className="text-frost-cyan-200">{done}</span> done
            <span className="mx-2 text-frost-text-faint">·</span>
            <span className="text-frost-text">{left}</span> left
          </p>
        </footer>

        <DayCalendar
          notes={day.notes}
          events={events}
          onAddNote={onAddNote}
          onNoteChange={onNoteChange}
          onDeleteNote={onDeleteNote}
          groups={groups}
          onNoteGroupChange={onNoteGroupChange}
          onRequestNewGroup={onRequestNewNoteGroup}
          importedAt={calendarImportedAt}
          importing={calendarImporting}
          onRefresh={onRefreshCalendar}
        />
      </div>
    </section>
  );
}
