import { useState } from 'react';
import type { Day } from '../types';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { TaskRow } from './TaskRow';

type Props = {
  day: Day;
  isToday: boolean;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => string;
  /**
   * What this weekday held last week, minus anything already on it this week.
   *
   * This replaced a fixed pool of thirty generic prompts that were marked as
   * seen the moment they rendered. That pool could not win: it ran out, it
   * burned entries during week-navigation that were never on screen long
   * enough to read, and "Finish your homework" was never going to be as
   * useful as the thing you actually wrote last Monday.
   */
  suggestions: string[];
  onUseSuggestion: (label: string) => void;
  onUseAllSuggestions: (labels: string[]) => void;
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
  suggestions,
  onUseSuggestion,
  onUseAllSuggestions,
}: Props) {
  const done = completedCount(day);
  const left = leftCount(day);
  const [focusId, setFocusId] = useState<string | null>(null);
  const isEmpty = day.tasks.length === 0;

  return (
    <section
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

          {/* Greyed, so they read as offers rather than as tasks already on the
              list. They are your own words from this weekday last week, which
              is why clicking one inserts the text instead of a blank row —
              there is nothing to clear when the wording is already yours.

              Deliberately NOT inside the empty state. Tied to it, taking one
              suggestion made the day non-empty and the remaining offers
              vanished mid-thought, so a Monday that repeats three things from
              last Monday could only ever give you the first. The list is
              filtered against what the day already holds, so it shrinks as you
              use it and disappears once there is nothing left to offer. */}
          {suggestions.length > 0 && (
            <div className="mt-6">
              <p className="text-xs text-frost-text-faint">last {day.label}</p>

              <div className="mt-2 flex flex-col items-start gap-0.5">
                {suggestions.map((label) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onUseSuggestion(label)}
                    className="flex items-center gap-2 py-1 text-left text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
                  >
                    <span className="font-mono" aria-hidden="true">
                      +
                    </span>
                    {label}
                  </button>
                ))}
              </div>

              {suggestions.length > 1 && (
                <button
                  type="button"
                  onClick={() => onUseAllSuggestions(suggestions)}
                  className="mt-1.5 py-1 text-sm text-frost-text-dim transition-colors duration-150 hover:text-frost-cyan-300"
                >
                  bring all {suggestions.length} forward
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="frost-divider mt-5 pt-4">
          <p className="font-mono text-sm text-frost-text-dim">
            <span className="text-frost-cyan-200">{done}</span> done
            <span className="mx-2 text-frost-text-faint">·</span>
            <span className="text-frost-text">{left}</span> left
          </p>
        </footer>
      </div>
    </section>
  );
}
