import { useEffect, useRef, useState } from 'react';
import type { Week } from '../types';
import { weekOverallPct, weekTotals } from '../lib/week';
import { ProgressRing } from './ProgressRing';

/**
 * The signature element (§2.4). Everything else on the screen is deliberately
 * quieter than this: it owns the only glow, the only looping animation, and the
 * only type above 32px.
 *
 * The stroke used to be 2px on a 244px ring — a 0.8% stroke ratio, so 97% of
 * the "focal point" was empty black, and the 26px day rings were carrying a
 * proportionally 9x heavier stroke than it. The hierarchy was inverted. 12px
 * makes the same element roughly 15x more present without adding a single new
 * bordered or glowing node.
 *
 * Diameter came back down from 244 to 176 afterwards. It still owns the only
 * glow, but on an Operate surface it was winning the squint test against the
 * checkboxes — the visitor's actual job — from the far side of the screen.
 * Signature and dominant are separable; this is the signature.
 */
export function HeroPanel({ week }: { week: Week }) {
  const pct = weekOverallPct(week);
  const { done, total } = weekTotals(week);

  // A one-shot reaction when the number actually climbs, so finishing a task
  // registers somewhere other than the checkbox you just clicked.
  const [ticking, setTicking] = useState(false);
  const prevPct = useRef(pct);
  useEffect(() => {
    if (pct > prevPct.current) {
      setTicking(true);
      const t = setTimeout(() => setTicking(false), 340);
      prevPct.current = pct;
      return () => clearTimeout(t);
    }
    prevPct.current = pct;
  }, [pct]);

  return (
    <section className="flex flex-col items-center" aria-label={`Week progress: ${pct}% complete`}>
      <div className="relative grid place-items-center">
        <ProgressRing percent={pct} size={176} strokeWidth={10} variant="hero" />

        <div className={`absolute flex flex-col items-center ${ticking ? 'frost-hero-tick' : ''}`}>
          <span className="frost-hero-text font-display text-5xl leading-none tracking-tight text-frost-cyan-200">
            {pct}
            <span className="ml-0.5 align-top text-lg text-frost-cyan-300">%</span>
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
