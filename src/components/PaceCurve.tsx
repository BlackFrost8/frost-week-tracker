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
export function PaceCurve({ week }: { week: Week }) {
  const { total } = weekTotals(week);
  const cumulative = weekCumulative(week);

  if (total === 0) return null;

  const x = (i: number) => PAD_X + (i / 6) * (W - PAD_X * 2);
  const y = (v: number) => H - PAD_Y - (v / total) * (H - PAD_Y * 2);

  const actual = cumulative.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const pace = `${x(0)},${y(0)} ${x(6)},${y(total)}`;

  // Where the real line stops climbing is where work stopped — mark it.
  const lastIndex = cumulative.reduce((acc, v, i) => (v > 0 ? i : acc), 0);
  const reached = cumulative[cumulative.length - 1];

  return (
    <figure className="flex flex-col gap-2">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-[104px] w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`${reached} of ${total} tasks done across the week`}
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
            cx={x(lastIndex)}
            cy={y(cumulative[lastIndex])}
            r="2.5"
            fill="var(--color-frost-cyan-200)"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>

      <figcaption className="flex justify-between font-mono text-xs text-frost-text-faint">
        <span>{DAY_SHORT.mon}</span>
        <span className="text-frost-text-dim">pace</span>
        <span>{DAY_SHORT.sun}</span>
      </figcaption>
    </figure>
  );
}
