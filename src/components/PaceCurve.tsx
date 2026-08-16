import type { Week } from '../types';
import { DAY_SHORT, weekCumulative, weekTotals } from '../lib/week';

const W = 300;
const H = 104;
const PAD_X = 2;
const PAD_Y = 8;

/**
 * Cumulative tasks completed across the week against an even-pace reference.
 * The only thing in the app that answers "am I on track" rather than "how much
 * is done" — every other number is a snapshot.
 *
 * Line only: no area fill, no gradient, no glow. A filled area would read as a
 * decorative slab and would eat the chroma budget the checkboxes need, and the
 * glow budget is fully spent on the hero.
 */
export function PaceCurve({ week, today }: { week: Week; today: string }) {
  const { total } = weekTotals(week);
  const cumulative = weekCumulative(week);

  if (total === 0) return null;

  const x = (i: number) => PAD_X + (i / 6) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_Y - (v / total) * (H - PAD_Y * 2);

  const actual = cumulative.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  /* Even pace is a seventh of the week done by the END of each day, so the
     reference at index 0 is one day's share — not zero. It used to start at
     zero, which compared Monday's end-of-day total against Monday's *start*:
     the whole reference sat a full day behind the line it was judging, and
     every week opened by telling you that you were ahead. */
  const pace = `${x(0)},${y(total / 7)} ${x(6)},${y(total)}`;

  const reached = cumulative[cumulative.length - 1];

  /* Which day you are actually on. -1 for any week that isn't this one, which
     is why the marker falls back to the end: a finished week stopped at Sunday
     and a future week has nothing done, so it draws no marker at all. */
  const todayIndex = week.days.findIndex((d) => d.date === today);
  const markIndex = todayIndex >= 0 ? todayIndex : 6;

  /* The gap between what you have done and an even pace, at today. Whole tasks,
     because half a task is not a thing anyone has.

     This replaces a marker that could never move: it looked for the last index
     whose cumulative total was above zero, but a running total never falls, so
     once anything was ticked every later day also qualified and the answer was
     always Sunday. It marked the end of the week and called it the end of the
     work. */
  const drift =
    todayIndex >= 0
      ? Math.round(cumulative[todayIndex] - (total * (todayIndex + 1)) / 7)
      : null;

  const standing =
    drift === null ? 'pace' : drift > 0 ? `${drift} ahead` : drift < 0 ? `${-drift} behind` : 'on track';

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[104px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={
          drift === null
            ? `${reached} of ${total} tasks done across the week`
            : `${reached} of ${total} tasks done across the week, ${standing} for today`
        }
      >
        <polyline
          points={pace}
          fill="none"
          stroke="var(--color-frost-cyan-700)"
          strokeWidth="1"
          strokeDasharray="3 4"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={actual}
          fill="none"
          stroke="var(--color-frost-cyan-300)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {reached > 0 && (
          <circle
            cx={x(markIndex)}
            cy={y(cumulative[markIndex])}
            r="2.5"
            fill="var(--color-frost-cyan-200)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <figcaption className="flex justify-between font-mono text-xs text-frost-text-faint">
        <span>{DAY_SHORT.mon}</span>
        {/* Deliberately the same quiet tier whether you are ahead or behind.
            Colouring "behind" as an alert would make the one element that
            answers "am I on track" into the one element that tells you off. */}
        <span className="text-frost-text-dim">{standing}</span>
        <span>{DAY_SHORT.sun}</span>
      </figcaption>
    </figure>
  );
}
