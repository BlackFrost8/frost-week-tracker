import { useEffect, useRef, useState } from 'react';
import { MAX_GOALS, MAX_GOAL_LABEL, makeGoal, type LongTermGoal } from '../lib/prefs';

type Props = {
  goals: LongTermGoal[];
  onSave: (goals: LongTermGoal[]) => void;
};

/**
 * What the weeks are for.
 *
 * It sits under the groups because the right column reads top to bottom as
 * widening scope: three lines about this week, then where its work was filed,
 * then the one thing that doesn't reset on Monday. Goals are account-level for
 * that last reason — a goal stored in a week document would be a new goal
 * every seven days.
 *
 * Deliberately thinner than a task: a label, and whether you got there. No
 * dates, no percentage, no sub-goals. The week underneath is the progress, and
 * a second bar here would be a number nobody could make true.
 */
export function GoalPanel({ goals, onSave }: Props) {
  /* Only ever one of these is set. `adding` opens a blank row at the end of
     the list; `editingId` reopens one that already exists. */
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const atCap = goals.length >= MAX_GOALS;
  const writing = adding || editingId !== null;

  useEffect(() => {
    if (writing) inputRef.current?.focus();
  }, [writing, editingId]);

  const close = () => {
    setAdding(false);
    setEditingId(null);
    setDraft('');
  };

  const openNew = () => {
    setEditingId(null);
    setDraft('');
    setAdding(true);
  };

  const openEdit = (goal: LongTermGoal) => {
    setAdding(false);
    setDraft(goal.label);
    setEditingId(goal.id);
  };

  /** Returns whether anything was written, so Enter knows to offer another row. */
  const commit = (): boolean => {
    const label = draft.trim().slice(0, MAX_GOAL_LABEL);

    if (adding) {
      if (label) onSave([...goals, makeGoal(label)]);
      close();
      return label !== '';
    }

    if (editingId) {
      const goal = goals.find((g) => g.id === editingId);
      // Emptying a goal removes it, the same way emptying a task row does.
      if (goal && !label) onSave(goals.filter((g) => g.id !== editingId));
      else if (goal && label !== goal.label)
        onSave(goals.map((g) => (g.id === editingId ? { ...g, label } : g)));
    }

    close();
    return false;
  };

  const toggle = (id: string) =>
    onSave(goals.map((g) => (g.id === id ? { ...g, done: !g.done } : g)));

  const remove = (id: string) => onSave(goals.filter((g) => g.id !== id));

  const field = (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="h-[18px] w-[18px] shrink-0 rounded-[4px]"
        style={{ border: '1px solid rgb(var(--frost-accent-rgb) / 0.18)' }}
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        value={draft}
        maxLength={MAX_GOAL_LABEL}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            const carriedOn = commit();
            // The same run-on behaviour a task row has, and it stops on a
            // blank — which is how the run ends without reaching for a mouse.
            if (carriedOn && goals.length + 1 < MAX_GOALS) openNew();
          }
          if (e.key === 'Escape') close();
        }}
        placeholder="What are you working toward?"
        aria-label={adding ? 'New goal' : 'Edit goal'}
        className="min-w-0 flex-1 bg-transparent text-sm text-frost-text outline-none placeholder:text-frost-text-faint"
      />
    </div>
  );

  return (
    <section className="flex flex-col gap-4" aria-label="Long-term goals">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs text-frost-cyan-500">long-term goals</span>
        {goals.length > 0 && !atCap && (
          <button
            type="button"
            onClick={openNew}
            className="text-xs text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-300"
          >
            + new
          </button>
        )}
      </div>

      {goals.length === 0 && !adding ? (
        <button
          type="button"
          onClick={openNew}
          className="self-start text-sm text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-300"
        >
          + click to enter
        </button>
      ) : (
        <div className="flex flex-col">
          {goals.map((goal) =>
            editingId === goal.id ? (
              <div key={goal.id}>{field}</div>
            ) : (
              <div
                key={goal.id}
                onClick={() => toggle(goal.id)}
                className="group flex cursor-pointer items-center gap-3 py-1.5"
              >
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={goal.done}
                  aria-label={goal.label}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(goal.id);
                  }}
                  className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-[4px] transition-colors duration-150"
                  style={
                    goal.done
                      ? {
                          backgroundColor: 'var(--color-frost-cyan-200)',
                          border: '1px solid var(--color-frost-cyan-200)',
                        }
                      : {
                          border: '1px solid rgb(var(--frost-accent-rgb) / 0.22)',
                          backgroundColor: 'rgb(var(--frost-accent-rgb) / 0.03)',
                        }
                  }
                >
                  {goal.done && (
                    <svg
                      viewBox="0 0 12 12"
                      className="frost-check h-2.5 w-2.5"
                      aria-hidden="true"
                    >
                      <path
                        d="M2 6.3 L4.6 8.9 L10 3.4"
                        fill="none"
                        stroke="var(--frost-on-accent)"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>

                {/* Wraps rather than truncates. A task is a line ticked off in
                    passing, but a goal is read — cutting "get into a good
                    university" at the column edge hides the half that matters. */}
                <span
                  className={`min-w-0 flex-1 text-sm leading-snug transition-colors duration-150 ${
                    goal.done ? 'text-frost-text-faint line-through' : 'text-frost-text'
                  }`}
                >
                  {goal.label}
                </span>

                <span className="frost-row-tools flex shrink-0 items-center gap-1 self-start transition-opacity duration-150">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEdit(goal);
                    }}
                    aria-label={`Edit ${goal.label}`}
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
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(goal.id);
                    }}
                    aria-label={`Delete ${goal.label}`}
                    className="grid h-6 w-6 place-items-center rounded text-frost-text-faint transition-colors hover:text-frost-alert"
                  >
                    <svg viewBox="0 0 14 14" className="h-3 w-3" aria-hidden="true">
                      <path
                        d="M3.5 3.5 L10.5 10.5 M10.5 3.5 L3.5 10.5"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
              </div>
            ),
          )}

          {adding && field}
        </div>
      )}
    </section>
  );
}
