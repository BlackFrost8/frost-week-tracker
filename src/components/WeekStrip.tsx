import type { Day, DayId } from '../types';
import { DAY_SHORT, cellDate, completedCount, completionPct, totalCount } from '../lib/week';

type Props = {
  days: Day[];
  selected: DayId;
  today: string;
  onSelect: (id: DayId) => void;
};

/**
 * Seven days as a horizontal strip rather than a vertical list.
 *
 * The week is a fixed-length, 7-element sequence, and rendering it as a
 * scrolling column was the shape reserved for unbounded lists — it misstated
 * the cardinality and left ~490px of dead span inside each of six rows. It is
 * also the element that lets the page be as wide as the screen deserves
 * without stretching a single line of text past its reading measure.
 *
 * The bars answer the one question these cells exist for — "which day am I
 * behind on?" — pre-attentively, which six stacked mono fractions could not.
 * They are flat fills: chroma, not light, so they spend nothing from the glow
 * budget.
 */
export function WeekStrip({ days, selected, today, onSelect }: Props) {
  return (
    <nav
      // 4px gaps on phones is not fussiness: at 375 with the shell's 16px
      // gutters, 6px gaps drop each cell to 43.9px — just under the 44px touch
      // minimum. 4px puts them at 45.6px.
      className="grid grid-cols-7 gap-1 sm:gap-3"
      aria-label="Week"
    >
      {days.map((day) => {
        const total = totalCount(day);
        const done = completedCount(day);
        const pct = completionPct(day);
        const isSelected = day.id === selected;
        const isToday = day.date === today;
        const complete = total > 0 && done === total;

        return (
          <button
            key={day.id}
            type="button"
            onClick={() => onSelect(day.id)}
            aria-pressed={isSelected}
            aria-current={isToday ? 'date' : undefined}
            aria-label={`${day.label}, ${done} of ${total} done`}
            className="group flex flex-col gap-2 pt-2 pb-2.5 text-left transition-colors duration-150"
          >
            <span className="flex items-baseline justify-between gap-1">
              <span
                className="text-sm transition-colors duration-150"
                style={{
                  color: isSelected
                    ? 'var(--color-frost-cyan-200)'
                    : isToday
                      ? 'var(--color-frost-text)'
                      : 'var(--color-frost-text-dim)',
                }}
              >
                {/* DAY_SHORT is already sentence case — the wordmark stays the
                    only uppercase element in the app. */}
                {DAY_SHORT[day.id]}
              </span>
              <span className="hidden font-mono text-xs text-frost-text-faint sm:inline">
                {cellDate(day.date)}
              </span>
            </span>

            {/* An unplanned day must read as absent, not as a failed one: a 0%
                bar and "nothing planned yet" are opposite states and must not
                share a glyph. */}
            {total === 0 ? (
              <span
                className="h-1 w-full rounded-full"
                style={{ backgroundColor: 'var(--frost-hairline)' }}
                aria-hidden="true"
              />
            ) : (
              <span
                className="h-1 w-full overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--color-frost-cyan-900)' }}
                aria-hidden="true"
              >
                <span
                  className="block h-full rounded-full transition-[width] duration-300 ease-out"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: complete
                      ? 'var(--color-frost-cyan-100)'
                      : 'var(--color-frost-cyan-200)',
                    opacity: isSelected || isToday ? 1 : 0.55,
                  }}
                />
              </span>
            )}

            <span className="font-mono text-xs tabular-nums text-frost-text-dim">
              {total === 0 ? (
                <span className="text-frost-text-faint">—</span>
              ) : (
                <>
                  {done}
                  <span className="text-frost-text-faint">/{total}</span>
                </>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
