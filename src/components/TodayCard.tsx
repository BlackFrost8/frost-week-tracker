import { useState } from 'react';
import type { Day } from '../types';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => string;
};

/**
 * The only card on the screen with a border and a glow (§2.4). The other six
 * days sit flat on the black background as list rows.
 */
export function TodayCard({ day, onToggle, onLabelChange, onDelete, onAdd }: Props) {
  const done = completedCount(day);
  const left = leftCount(day);
  const [focusId, setFocusId] = useState<string | null>(null);

  return (
    <section
      className="frost-today-glow frost-rise rounded-2xl p-6 sm:p-8"
      // A flat #0a0d10 fill was 1.08:1 against the page — invisible, so the
      // "only card on the screen" didn't read as a card at all. A large, low
      // alpha cyan bloom in one corner picks the ambient wash up instead of
      // sitting in front of it as a slab.
      style={{
        background:
          'radial-gradient(130% 110% at 0% 0%, rgba(0,239,255,0.075), rgba(0,8,8,0.9) 62%)',
      }}
      aria-label={`Today, ${day.label}`}
    >
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-xs text-frost-cyan-200">today</p>
          <h2 className="mt-1 font-display text-2xl leading-none tracking-tight text-frost-text">
            {day.label}
          </h2>
        </div>
        <p className="font-mono text-sm text-frost-text-dim">{longDayDate(day.date)}</p>
      </header>

      {/* Capped so 14px task labels don't sit in 640px of empty black. */}
      <div className="frost-divider mt-6 max-w-[54ch] pt-2">
        {day.tasks.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            autoFocus={task.id === focusId}
            onToggle={() => onToggle(task.id)}
            onLabelChange={(label) => onLabelChange(task.id, label)}
            onDelete={() => onDelete(task.id)}
          />
        ))}

        {day.tasks.length === 0 && (
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

      <footer className="frost-divider mt-5 max-w-[54ch] pt-4">
        <p className="font-mono text-sm text-frost-text-dim">
          <span className="text-frost-cyan-200">{done}</span> done
          <span className="mx-2 text-frost-text-faint">·</span>
          <span className="text-frost-text">{left}</span> left
        </p>
      </footer>
    </section>
  );
}
