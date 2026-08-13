import type { Week } from '../types';
import { DAY_SHORT, completionPct, todayISO, weekOverallPct, weekTotals } from '../lib/week';
import { ProgressRing } from './ProgressRing';

export function WeekOverview({ week }: { week: Week }) {
  const overall = weekOverallPct(week);
  const { done, total } = weekTotals(week);
  const today = todayISO();

  return (
    <section className="frost-panel flex flex-col gap-6 p-5 sm:flex-row sm:items-center">
      {/* Daily bars */}
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-[11px] uppercase tracking-[0.22em] text-frost-text-dim">
          Overall Progress
        </h2>

        <div className="mt-4 flex h-32 items-end gap-2 sm:gap-3">
          {week.days.map((day) => {
            const pct = completionPct(day);
            const isToday = day.date === today;
            const lit = pct >= 80;
            return (
              <div key={day.id} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span
                  className={`font-mono text-[10px] tabular-nums ${
                    pct > 0 ? 'text-frost-cyan-bright' : 'text-frost-text-dim/50'
                  }`}
                >
                  {pct}
                </span>

                <div
                  className="relative flex w-full flex-1 items-end overflow-hidden rounded-[3px]"
                  style={{
                    backgroundColor: 'rgba(0,229,255,0.06)',
                    border: '1px solid rgba(0,229,255,0.08)',
                  }}
                >
                  <div
                    className={`w-full rounded-[2px] ${lit ? 'frost-glow' : ''}`}
                    style={{
                      height: `${Math.max(pct, 0)}%`,
                      background:
                        pct === 100
                          ? 'linear-gradient(180deg, var(--color-frost-cyan-bright), var(--color-frost-cyan))'
                          : 'var(--color-frost-cyan)',
                      opacity: pct === 0 ? 0 : 1,
                      transition: 'height 500ms ease-out, opacity 300ms ease-out',
                    }}
                  />
                </div>

                <span
                  className={`font-display text-[10px] uppercase tracking-[0.1em] ${
                    isToday ? 'text-frost-cyan' : 'text-frost-text-dim'
                  }`}
                >
                  {DAY_SHORT[day.id]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hero ring */}
      <div
        className="flex items-center justify-center gap-5 sm:flex-col sm:gap-3 sm:border-l sm:pl-8"
        style={{ borderColor: 'var(--frost-border)' }}
      >
        <ProgressRing
          percent={overall}
          size={148}
          strokeWidth={11}
          hero
          glow={overall > 0}
        />
        <div className="text-center">
          <p className="font-mono text-sm tabular-nums text-frost-text">
            {done} <span className="text-frost-text-dim">/</span> {total}
          </p>
          <p className="mt-0.5 font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
            Completed
          </p>
        </div>
      </div>
    </section>
  );
}
