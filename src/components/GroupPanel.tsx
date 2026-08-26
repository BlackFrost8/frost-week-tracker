import { useState } from 'react';
import type { DayId, Week } from '../types';
import type { TaskGroup } from '../lib/prefs';
import { DAY_SHORT, groupTasks } from '../lib/week';
import { TaskIcon } from './TaskIcon';

type Props = {
  week: Week;
  groups: TaskGroup[];
  selected: DayId;
  onSelectDay: (dayId: DayId) => void;
  /** Undefined once the account is at the group cap — see MAX_GROUPS. */
  onNewGroup?: () => void;
  onEditGroup: (group: TaskGroup) => void;
};

/**
 * Where a group's tasks can be seen together.
 *
 * The complaint this answers is precise: tasks pile up across seven days and a
 * school task cannot be found among them. So the panel's job is *retrieval*,
 * not another place to work — open a group and it lists every task filed there
 * this week with the day it sits on, and clicking one takes you to that day's
 * card. Checking things off deliberately stays in the one place it has always
 * been, so there is never a second copy of a task row to disagree with the
 * first.
 *
 * One group open at a time. Several at once turns a sidebar into a second
 * full-length list of the week, which is the thing being escaped from.
 */
export function GroupPanel({
  week,
  groups,
  selected,
  onSelectDay,
  onNewGroup,
  onEditGroup,
}: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-4" aria-label="Groups">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-frost-cyan-500">groups</span>
        {groups.length > 0 && onNewGroup && (
          <button
            type="button"
            onClick={onNewGroup}
            className="text-xs text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-300"
          >
            + new
          </button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-frost-text-dim">Sorting tasks easier.</p>
          {onNewGroup && (
            <button
              type="button"
              onClick={onNewGroup}
              className="text-sm text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-300"
            >
              + make a group
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((group) => {
            const tasks = groupTasks(week, group.id);
            const done = tasks.filter((t) => t.task.done).length;
            const total = tasks.length;
            const pct = total === 0 ? 0 : Math.round((done / total) * 100);
            const isOpen = openId === group.id;

            return (
              <div key={group.id} className="group flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : group.id)}
                    aria-expanded={isOpen}
                    aria-label={`${group.name}, ${done} of ${total} done`}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <span
                      className="shrink-0 transition-colors duration-150"
                      style={{
                        color: isOpen
                          ? 'var(--color-frost-cyan-200)'
                          : 'var(--color-frost-cyan-300)',
                      }}
                    >
                      <TaskIcon icon={group.icon} size={17} strokeWidth={1.8} />
                    </span>
                    <span
                      className="min-w-0 flex-1 truncate text-sm transition-colors duration-150"
                      style={{
                        color: isOpen
                          ? 'var(--color-frost-cyan-100)'
                          : 'var(--color-frost-text)',
                      }}
                    >
                      {group.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-frost-cyan-500">
                      {total === 0 ? '—' : `${done}/${total}`}
                    </span>
                  </button>

                  <span className="frost-row-tools flex shrink-0 transition-opacity duration-150">
                    <button
                      type="button"
                      onClick={() => onEditGroup(group)}
                      aria-label={`Edit ${group.name}`}
                      className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-cyan-300"
                    >
                      <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
                        <path
                          d="M9.2 1.8 12.2 4.8 4.7 12.3 1.2 12.8 1.7 9.3 Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.3"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </span>
                </div>

                {/* The same bar the week strip uses, for the same reason: a
                    fraction has to be read, a bar is seen. An empty group gets
                    the hairline instead — nothing planned and nothing done are
                    opposite states and must not share a glyph. */}
                <span
                  className="h-1 w-full overflow-hidden rounded-full"
                  style={{
                    backgroundColor:
                      total === 0 ? 'var(--frost-hairline)' : 'var(--color-frost-cyan-900)',
                  }}
                  aria-hidden="true"
                >
                  {total > 0 && (
                    <span
                      className="block h-full rounded-full transition-[width] duration-300 ease-out"
                      style={{
                        width: `${pct}%`,
                        backgroundColor:
                          done === total
                            ? 'var(--color-frost-cyan-100)'
                            : 'var(--color-frost-cyan-200)',
                        opacity: isOpen ? 1 : 0.55,
                      }}
                    />
                  )}
                </span>

                {isOpen && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {total === 0 && (
                      <p className="py-1 text-sm text-frost-text-faint">
                        nothing in this group yet
                      </p>
                    )}

                    {tasks.map(({ day, task }) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => onSelectDay(day.id)}
                        aria-label={`${task.label}, ${day.label}${task.done ? ', done' : ''}`}
                        /* A finished row recedes by opacity, not by dropping to
                           a dimmer tier. On a light theme the ramp runs the
                           other way — 500 mixes toward black and lands *darker*
                           than 100 — so a colour swap made done tasks the
                           loudest thing in the panel. Opacity means the same
                           thing on every preset. */
                        className={`flex items-center gap-2.5 rounded py-1 pr-1 text-left transition-opacity duration-150 hover:bg-[rgb(var(--frost-far-rgb)/0.04)] ${
                          task.done ? 'opacity-55' : ''
                        }`}
                      >
                        {/* A tick, not a checkbox: this list reports, it does
                            not act. A live checkbox here would be a second
                            copy of the task row, and two of anything that can
                            be clicked is two things that can disagree. */}
                        <span className="grid h-3 w-3 shrink-0 place-items-center">
                          {task.done && (
                            <svg
                              viewBox="0 0 12 12"
                              className="h-2.5 w-2.5"
                              aria-hidden="true"
                              style={{ color: 'var(--color-frost-cyan-200)' }}
                            >
                              <path
                                d="M2 6.3 L4.6 8.9 L10 3.4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          )}
                        </span>

                        <span
                          className={`min-w-0 flex-1 truncate text-sm ${
                            task.done ? 'line-through' : ''
                          }`}
                          style={{ color: 'var(--color-frost-cyan-100)' }}
                        >
                          {task.label}
                        </span>

                        <span
                          className="shrink-0 font-mono text-xs lowercase"
                          style={{
                            color:
                              day.id === selected
                                ? 'var(--color-frost-cyan-300)'
                                : 'var(--color-frost-text-faint)',
                          }}
                        >
                          {DAY_SHORT[day.id].slice(0, 3)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
