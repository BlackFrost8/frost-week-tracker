import { useEffect, useState } from 'react';
import type { Day } from '../types';
import { completedCount, leftCount, longDayDate } from '../lib/week';
import { takePrompt } from '../lib/suggestions';
import { TaskRow } from './TaskRow';

/** The prompt already handed to a given date this session, so revisiting a day
    doesn't spend another from a pool that never refills. */
const claimed = new Map<string, string | null>();

type Props = {
  day: Day;
  isToday: boolean;
  onToggle: (taskId: string) => void;
  onLabelChange: (taskId: string, label: string) => void;
  onDelete: (taskId: string) => void;
  onAdd: () => string;
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
export function DayCard({ day, isToday, onToggle, onLabelChange, onDelete, onAdd }: Props) {
  const done = completedCount(day);
  const left = leftCount(day);
  const [focusId, setFocusId] = useState<string | null>(null);

  /* The prompt is claimed in an effect rather than during render because
     `takePrompt` marks it as seen, and StrictMode renders twice — which would
     silently burn two prompts for every one shown.

     `claimed` is keyed by calendar date and lives for the session, so clicking
     between days and coming back shows the same prompt instead of spending
     another. Thirty prompts would otherwise be gone in thirty glances, and
     none of them ever come back. */
  const [prompt, setPrompt] = useState<string | null>(null);
  const isEmpty = day.tasks.length === 0;

  useEffect(() => {
    if (!isEmpty) {
      // The prompt belongs to the empty state only. It is not re-claimed when
      // a day is emptied again, so deleting tasks can't farm fresh ones.
      setPrompt(null);
      return;
    }
    if (claimed.has(day.date)) {
      setPrompt(claimed.get(day.date) ?? null);
      return;
    }
    const picked = takePrompt();
    claimed.set(day.date, picked);
    setPrompt(picked);
  }, [day.date, isEmpty]);

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
            <div className="py-2">
              <p className="text-sm text-frost-text-faint">nothing planned yet</p>

              {/* Greyed on purpose: it must read as an idea rather than as a
                  task that is already there.

                  Clicking it opens an EMPTY row, not one pre-filled with the
                  suggestion. The suggestion's job is to break the blank page —
                  what you actually write is nearly always a version of it, not
                  it word for word, and handing over pre-filled text means
                  clearing someone else's wording before you can type yours. */}
              {prompt && (
                <button
                  type="button"
                  onClick={() => setFocusId(onAdd())}
                  className="mt-3 flex items-center gap-2 text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-cyan-300"
                >
                  <span className="font-mono" aria-hidden="true">
                    +
                  </span>
                  {prompt}
                </button>
              )}
            </div>
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
      </div>
    </section>
  );
}
