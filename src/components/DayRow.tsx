import type { Day } from '../types';
import { completedCount, completionPct, shortDayDate, totalCount } from '../lib/week';
import { ProgressRing } from './ProgressRing';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  expanded: boolean;
  onExpand: () => void;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => void;
};

/**
 * A non-today day: no border, no glow, no card. Separated from its neighbours
 * by a hairline and spacing only (§1.2, §2.4). Collapsed to a summary until
 * clicked, which is what breaks the "wall of identical boxes".
 */
export function DayRow({
  day,
  expanded,
  onExpand,
  onToggle,
  onLabelChange,
  onDelete,
  onAdd,
}: Props) {
  const pct = completionPct(day);
  const done = completedCount(day);
  const total = totalCount(day);

  return (
    <div className="frost-divider">
      <button
        type="button"
        onClick={onExpand}
        aria-expanded={expanded}
        className="group flex w-full items-center gap-4 py-3 text-left transition-colors duration-150"
      >
        <span className="relative grid shrink-0 place-items-center">
          <ProgressRing percent={pct} size={26} strokeWidth={2} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block text-base text-frost-text transition-colors duration-150 group-hover:text-frost-cyan-300">
            {day.label}
          </span>
          <span className="mt-0.5 block font-mono text-xs text-frost-text-faint">
            {shortDayDate(day.date)}
          </span>
        </span>

        <span className="shrink-0 font-mono text-sm tabular-nums text-frost-text-dim">
          {done}
          <span className="text-frost-text-faint">/{total}</span>
        </span>

        <svg
          viewBox="0 0 12 12"
          className="h-3 w-3 shrink-0 text-frost-text-faint transition-transform duration-150"
          style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}
          aria-hidden="true"
        >
          <path
            d="M4.5 2 L8.5 6 L4.5 10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {expanded && (
        <div className="frost-rise pb-4 pl-10">
          {day.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              dense
              onToggle={() => onToggle(task.id)}
              onLabelChange={(label) => onLabelChange(task.id, label)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
          <button
            type="button"
            onClick={onAdd}
            className="mt-1.5 flex items-center gap-3 py-1 text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-text-dim"
          >
            <span className="grid h-4 w-4 place-items-center font-mono">+</span>
            add task
          </button>
        </div>
      )}
    </div>
  );
}
