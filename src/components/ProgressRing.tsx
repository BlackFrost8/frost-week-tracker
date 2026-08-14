type Props = {
  percent: number;
  size: number;
  strokeWidth: number;
  /**
   * `hero` is the single focal point of the screen — the only ring allowed a
   * glow or a looping animation. `quiet` is everything else: flat, dim, no glow.
   */
  variant?: 'hero' | 'quiet';
};

export function ProgressRing({ percent, size, strokeWidth, variant = 'quiet' }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const isHero = variant === 'hero';

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="-rotate-90"
      aria-hidden="true"
    >
      {/* Only one hero ring exists, so this id can't collide. The three palette
          cyans are within 7° of hue of each other, which makes them useless as
          separate tokens — but strung along one arc the shift reads as light
          dispersing rather than as a flat stroke. It's the one place the spread
          is perceptible. */}
      {isHero && (
        <defs>
          <linearGradient id="frost-hero-arc" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--color-frost-cyan-300)" />
            <stop offset="55%" stopColor="var(--color-frost-cyan-200)" />
            <stop offset="100%" stopColor="var(--color-frost-cyan-100)" />
          </linearGradient>
        </defs>
      )}

      {/* The hero track is now cyan rather than 7%-white. At a 12px stroke it
          is ~8,700px² of colour that is on screen unconditionally — which is
          what stops a 0% week from being an entirely achromatic page. */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isHero ? 'var(--color-frost-cyan-900)' : 'rgb(var(--frost-far-rgb) / 0.06)'}
        strokeWidth={strokeWidth}
      />
      <circle
        className={isHero && clamped > 0 ? 'frost-hero-glow' : undefined}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isHero ? 'url(#frost-hero-arc)' : 'var(--color-frost-cyan-700)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        // No opacity kill at 0%: a zero-length dash already paints nothing, and
        // the old rule also hid the arc's rounded cap at low single-digit
        // percentages.
        style={{ transition: 'stroke-dashoffset 420ms ease-out' }}
      />
    </svg>
  );
}
