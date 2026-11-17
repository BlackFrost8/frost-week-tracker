import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Day, DayId, Task } from '../types';
import { intervalById, type Interval, type TaskGroup } from '../lib/prefs';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { DayCalendar } from './DayCalendar';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  isToday: boolean;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  /** Adds a blank row to the unsorted list, or to the interval named. */
  onAdd: (intervalId?: string | null) => string;
  /** The account's intervals. Only shown while `intervalsOn`. */
  intervals: Interval[];
  intervalsOn: boolean;
  onIntervalChange: (taskId: string, intervalId: string | null) => void;
  /** Where a dragged task was put down: its interval, and the task it now sits above. */
  onPlaceTask: (taskId: string, intervalId: string | null, beforeId: string | null) => void;
  groups: TaskGroup[];
  onGroupChange: (taskId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewGroup?: (taskId: string) => void;
  /** Every day of the week, so a task can be sent to one of the other six. */
  days: Day[];
  onMoveTask: (taskId: string, toDayId: DayId) => void;
  onAddNote: () => string;
  onNoteChange: (noteId: string, text: string) => void;
  onDeleteNote: (noteId: string) => void;
  onNoteGroupChange: (noteId: string, groupId: string | null) => void;
  /** Undefined at the group cap — see MAX_GROUPS. */
  onRequestNewNoteGroup?: (noteId: string) => void;
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
  intervals,
  intervalsOn,
  onIntervalChange,
  onPlaceTask,
  groups,
  onGroupChange,
  onRequestNewGroup,
  days,
  onMoveTask,
  onAddNote,
  onNoteChange,
  onDeleteNote,
  onNoteGroupChange,
  onRequestNewNoteGroup,
}: Props) {
  const done = completedCount(day);
  const left = leftCount(day);
  const [focusId, setFocusId] = useState<string | null>(null);
  const isEmpty = day.tasks.length === 0;

  // Computed once for the whole list rather than per row: the day a task is
  // already on is not a place it can be moved to.
  const moveTargets = days.filter((d) => d.id !== day.id);

  /* Intervals divide the list only when there is something to divide it by.
     Switched on with none written yet, the card is the plain list it always
     was, rather than a list with a grip on every row that leads nowhere. */
  const sectioned = intervalsOn && intervals.length > 0;
  const zoneOf = (task: Task): string | null =>
    sectioned && intervalById(intervals, task.intervalId) ? task.intervalId : null;

  const { drag, startDrag, listRef } = useTaskDrag(onPlaceTask);

  const renderRows = (tasks: Task[], zone: string | null) => (
    // `relative` so the drop line can be laid over the list rather than into
    // it: a line that took up room would move every row under the pointer,
    // and the pointer would then be over a different gap.
    <div className="relative">
      {tasks.map((task) => (
        <div key={task.id} data-task-id={task.id} className="relative">
          {drag?.target?.zone === zone && drag.target.beforeId === task.id && <DropLine />}
          <div
            className="transition-opacity duration-150"
            style={{ opacity: drag?.taskId === task.id ? 0.35 : 1 }}
          >
            <TaskRow
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
              // The next row goes where this one is: typing down a list of
              // morning tasks keeps them in the morning.
              onContinue={() => setFocusId(onAdd(zone))}
              intervals={sectioned ? intervals : undefined}
              intervalId={zone}
              onIntervalChange={(intervalId) => onIntervalChange(task.id, intervalId)}
              onDragStart={sectioned ? (point) => startDrag(task, point) : undefined}
            />
          </div>
        </div>
      ))}
      {drag?.target?.zone === zone && drag.target.beforeId === null && (
        <DropLine end={tasks.length > 0} />
      )}
    </div>
  );

  const unsorted = day.tasks.filter((t) => zoneOf(t) === null);

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

        <div ref={listRef} className="frost-divider mt-6 pt-2">
          {/* Every section is a drop zone, and they touch: spacing is padding
              inside each rather than margin between them, so there is no gap
              the pointer can fall through on the way from one to the next. */}
          <div data-drop-zone="" className="rounded-lg">
            {renderRows(unsorted, null)}

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

          {/* Below the list, in the order they were written in settings: a
              name, a line, and whatever has been filed there. */}
          {sectioned &&
            intervals.map((interval) => {
              const tasks = day.tasks.filter((t) => zoneOf(t) === interval.id);
              const targeted = drag?.target?.zone === interval.id;
              return (
                <section
                  key={interval.id}
                  data-drop-zone={interval.id}
                  aria-label={interval.name}
                  className="rounded-lg pt-5 transition-colors duration-150"
                  style={{
                    backgroundColor: targeted ? 'rgb(var(--frost-accent-rgb) / 0.04)' : undefined,
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3
                      className="truncate text-xs"
                      style={{
                        color: targeted
                          ? 'var(--color-frost-cyan-200)'
                          : 'var(--color-frost-cyan-500)',
                      }}
                    >
                      {interval.name}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setFocusId(onAdd(interval.id))}
                      aria-label={`Add a task to ${interval.name}`}
                      title={`Add a task to ${interval.name}`}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded font-mono text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
                    >
                      +
                    </button>
                  </div>
                  <div className="frost-divider mt-1 pt-1">
                    {renderRows(tasks, interval.id)}
                    {tasks.length === 0 && (
                      <p className="py-1.5 text-xs text-frost-text-faint">
                        {drag ? 'drop here' : 'drag a task here'}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
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
          onAddNote={onAddNote}
          onNoteChange={onNoteChange}
          onDeleteNote={onDeleteNote}
          groups={groups}
          onNoteGroupChange={onNoteGroupChange}
          onRequestNewGroup={onRequestNewNoteGroup}
        />
      </div>

      {drag && <DragGhost drag={drag} />}
    </section>
  );
}

/** Where the line goes while a task is being dragged over a list. */
function DropLine({ end = false }: { end?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded-full ${
        end ? '-bottom-px' : '-top-px'
      }`}
      style={{ backgroundColor: 'var(--color-frost-cyan-300)' }}
    />
  );
}

type DropTarget = { zone: string | null; beforeId: string | null };
type DragState = {
  taskId: string;
  label: string;
  x: number;
  y: number;
  /** Null while the pointer is somewhere a task cannot be put down. */
  target: DropTarget | null;
};

/** The large-display scale on `:root`, or 1 on every ordinary screen. */
function pageZoom(): number {
  return Number(getComputedStyle(document.documentElement).getPropertyValue('--frost-zoom')) || 1;
}

/** How close to the top or bottom of the screen a drag starts scrolling it. */
const EDGE = 72;

/**
 * Dragging a task between the unsorted list and the intervals under it.
 *
 * Pointer events rather than the HTML drag-and-drop API, which does not fire
 * for a finger on most phones — and a phone between two lessons is where this
 * list is most often rearranged. The press itself is recognised by the grip
 * (`IntervalMenu`); this owns the drag from there to the drop.
 *
 * Releasing over nothing, or pressing Escape, puts the task back untouched.
 */
function useTaskDrag(
  onPlace: (taskId: string, intervalId: string | null, beforeId: string | null) => void,
) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const onPlaceRef = useRef(onPlace);
  onPlaceRef.current = onPlace;

  const hitTest = (x: number, y: number): DropTarget | null => {
    const zoneEl = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-drop-zone]');
    if (!zoneEl || !listRef.current?.contains(zoneEl)) return null;
    // The first row whose middle is still below the pointer is the one the
    // task goes above; past the last middle, it goes at the end.
    const rows = Array.from(zoneEl.querySelectorAll<HTMLElement>('[data-task-id]'));
    const below = rows.find((row) => {
      const box = row.getBoundingClientRect();
      return y < box.top + box.height / 2;
    });
    return { zone: zoneEl.dataset.dropZone || null, beforeId: below?.dataset.taskId ?? null };
  };

  const set = (next: DragState | null) => {
    dragRef.current = next;
    setDrag(next);
  };

  const startDrag = (task: Task, point: { x: number; y: number }) =>
    set({ taskId: task.id, label: task.label, ...point, target: hitTest(point.x, point.y) });

  const dragId = drag?.taskId ?? null;

  useEffect(() => {
    if (!dragId) return;

    const update = (x: number, y: number) => {
      const current = dragRef.current;
      if (current) set({ ...current, x, y, target: hitTest(x, y) });
    };

    const move = (e: PointerEvent) => {
      e.preventDefault();
      update(e.clientX, e.clientY);
    };

    /* A press that became a drag still ends in a click, and that click lands
       on whatever was under the pointer — which on this card is a task row,
       and clicking a row ticks it. Swallowed here, once; the timer clears the
       listener when the browser sends no click at all, as a moved touch does. */
    const swallowNextClick = () => {
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };

    const finish = (commit: boolean) => {
      const done = dragRef.current;
      set(null);
      swallowNextClick();
      if (commit && done?.target) {
        onPlaceRef.current(done.taskId, done.target.zone, done.target.beforeId);
      }
    };

    const up = () => finish(true);
    const cancel = () => finish(false);
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      finish(false);
    };

    // Near an edge, the page scrolls under the task, so a long day can be
    // crossed in one drag. Re-tested every frame, since the rows move.
    let raf = 0;
    const scroll = () => {
      const current = dragRef.current;
      if (current) {
        const vh = window.innerHeight;
        const dy =
          current.y < EDGE ? -(EDGE - current.y) / 4 : current.y > vh - EDGE ? (current.y - (vh - EDGE)) / 4 : 0;
        if (dy) {
          window.scrollBy(0, dy);
          update(current.x, current.y);
        }
      }
      raf = requestAnimationFrame(scroll);
    };
    raf = requestAnimationFrame(scroll);

    // No text selection, and the closed hand, for as long as the task is held.
    const { userSelect, cursor } = document.body.style;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    document.addEventListener('keydown', key, true);
    return () => {
      cancelAnimationFrame(raf);
      document.body.style.userSelect = userSelect;
      document.body.style.cursor = cursor;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      document.removeEventListener('keydown', key, true);
    };
    // `hitTest` and `set` read only refs, so the drag's own id is all this
    // depends on: one set of listeners per drag, not per pointer move.
  }, [dragId]);

  return { drag, startDrag, listRef };
}

/** The task's name under the pointer while it is being carried. */
function DragGhost({ drag }: { drag: { label: string; x: number; y: number } }) {
  const zoom = pageZoom();
  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed z-[90] max-w-[260px] truncate rounded-lg px-3 py-1.5 text-sm text-frost-text"
      style={{
        left: drag.x / zoom + 12,
        top: drag.y / zoom - 14,
        backgroundColor: 'var(--color-frost-surface-2)',
        border: '1px solid rgb(var(--frost-accent-rgb) / 0.35)',
        boxShadow: '0 12px 28px -12px rgb(var(--frost-base-rgb) / 0.9)',
      }}
    >
      {drag.label}
    </div>,
    document.body,
  );
}
