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
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isHero ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.06)'}
        strokeWidth={strokeWidth}
      />
      <circle
        className={isHero && clamped > 0 ? 'frost-hero-glow' : undefined}
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={isHero ? 'var(--color-frost-cyan-300)' : 'var(--color-frost-cyan-700)'}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{
          transition: 'stroke-dashoffset 420ms ease-out',
          opacity: clamped === 0 ? 0 : 1,
        }}
      />
    </svg>
  );
}
