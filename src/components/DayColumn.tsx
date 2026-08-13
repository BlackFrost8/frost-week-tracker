import { useEffect, useRef, useState } from 'react';
import type { Day } from '../types';
import { completedCount, completionPct, formatShortDate, leftCount } from '../lib/week';
import { ProgressRing } from './ProgressRing';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  isToday: boolean;
  index: number;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => void;
};

export function DayColumn({
  day,
  isToday,
  index,
  onToggle,
  onLabelChange,
  onDelete,
  onAdd,
}: Props) {
  const pct = completionPct(day);
  const done = completedCount(day);
  const left = leftCount(day);
  const isComplete = pct === 100 && done > 0;

  // Flash the column border once as the day tips over into 100%.
  const [flash, setFlash] = useState(false);
  const prevComplete = useRef(isComplete);
  useEffect(() => {
    if (isComplete && !prevComplete.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 620);
      prevComplete.current = isComplete;
      return () => clearTimeout(t);
    }
    prevComplete.current = isComplete;
  }, [isComplete]);

  return (
    <section
      className={`frost-fade-up frost-panel frost-panel-hover flex flex-col overflow-hidden ${
        flash ? 'frost-flash' : isToday ? 'frost-pulse' : ''
      }`}
      style={{
        animationDelay: flash ? undefined : `${index * 40}ms`,
        borderColor: isToday ? 'rgba(0,229,255,0.42)' : undefined,
      }}
      aria-label={`${day.label}, ${pct}% complete`}
    >
      {/* Header */}
      <header
        className="px-3 pt-3 pb-2 text-center"
        style={{ borderBottom: '1px solid var(--frost-border)' }}
      >
        <h2
          className={`font-display text-[13px] font-semibold uppercase tracking-[0.18em] ${
            isToday ? 'text-frost-cyan-bright frost-glow-text' : 'text-frost-text'
          }`}
        >
          {day.label}
        </h2>
        <p className="mt-0.5 font-mono text-[10px] tracking-wider text-frost-text-dim">
          {formatShortDate(day.date)}
          {isToday && <span className="ml-1.5 text-frost-cyan">• TODAY</span>}
        </p>
      </header>

      {/* Ring */}
      <div className="flex justify-center py-4">
        <ProgressRing percent={pct} size={92} strokeWidth={7} glow={isComplete} />
      </div>

      {/* Tasks */}
      <div className="flex-1 px-1.5 pb-1">
        <p className="px-1.5 pb-1 font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
          Tasks
        </p>
        <div className="flex flex-col">
          {day.tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => onToggle(task.id)}
              onLabelChange={(label) => onLabelChange(task.id, label)}
              onDelete={() => onDelete(task.id)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onAdd}
          className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-[12px] text-frost-text-dim transition-colors duration-150 hover:bg-frost-cyan/[0.05] hover:text-frost-cyan"
        >
          <span className="font-mono text-sm leading-none">+</span>
          add task
        </button>
      </div>

      {/* Footer stats — derived, never stored (spec §4.4) */}
      <footer
        className="mt-1 font-mono text-[11px]"
        style={{ borderTop: '1px solid var(--frost-border)' }}
      >
        <div
          className="flex items-center justify-between px-3 py-1.5"
          style={{ backgroundColor: 'rgba(0,229,255,0.045)' }}
        >
          <span className="uppercase tracking-[0.15em] text-frost-text-dim">Completed</span>
          <span className={done > 0 ? 'text-frost-cyan-bright' : 'text-frost-text-dim'}>
            {done}
          </span>
        </div>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="uppercase tracking-[0.15em] text-frost-text-dim">Left</span>
          <span className={left > 0 ? 'text-frost-text' : 'text-frost-cyan-bright'}>{left}</span>
        </div>
      </footer>
    </section>
  );
}
