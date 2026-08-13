import type { Week } from '../types';
import { weekOverallPct, weekTotals } from '../lib/week';
import { ProgressRing } from './ProgressRing';

/**
 * The signature element (§2.4). Everything else on the screen is deliberately
 * quieter than this: it owns the only glow, the only looping animation, and the
 * only type above 32px.
 */
export function HeroPanel({ week }: { week: Week }) {
  const pct = weekOverallPct(week);
  const { done, total } = weekTotals(week);

  return (
    <section className="flex flex-col items-center" aria-label={`Week progress: ${pct}% complete`}>
      <div className="relative grid place-items-center">
        <ProgressRing percent={pct} size={244} strokeWidth={2} variant="hero" />

        <div className="absolute flex flex-col items-center">
          <span className="frost-hero-text font-display text-5xl leading-none tracking-tight text-frost-cyan-100">
            {pct}
            <span className="ml-0.5 align-top text-lg text-frost-cyan-700">%</span>
          </span>
          <span className="mt-3 font-mono text-sm tabular-nums text-frost-text-dim">
            {done} / {total}
          </span>
        </div>
      </div>

      <p className="mt-5 text-sm text-frost-text-dim">tasks done this week</p>
    </section>
  );
}
