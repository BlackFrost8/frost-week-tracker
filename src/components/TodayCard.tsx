import type { Day } from '../types';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => void;
};

/**
 * The only card on the screen with a border and a glow (§2.4). The other six
 * days sit flat on the black background as list rows.
 */
export function TodayCard({ day, onToggle, onLabelChange, onDelete, onAdd }: Props) {
  const done = completedCount(day);
  const left = leftCount(day);

  return (
    <section
      className="frost-today-glow frost-rise rounded-2xl p-6 sm:p-8"
      style={{ backgroundColor: 'var(--color-frost-surface)' }}
      aria-label={`Today, ${day.label}`}
    >
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-frost-cyan-700">today</p>
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
            onToggle={() => onToggle(task.id)}
            onLabelChange={(label) => onLabelChange(task.id, label)}
            onDelete={() => onDelete(task.id)}
          />
        ))}

        <button
          type="button"
          onClick={onAdd}
          className="mt-2 flex items-center gap-3 py-1.5 text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-text-dim"
        >
          <span className="grid h-4 w-4 place-items-center font-mono">+</span>
          add task
        </button>
      </div>

      <footer className="frost-divider mt-5 pt-4">
        <p className="font-mono text-sm text-frost-text-dim">
          <span className="text-frost-cyan-300">{done}</span> done
          <span className="mx-2 text-frost-text-faint">·</span>
          <span className="text-frost-text">{left}</span> left
        </p>
      </footer>
    </section>
  );
}
