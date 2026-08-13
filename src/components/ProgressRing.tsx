import { useEffect, useRef, useState } from 'react';

type Props = {
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** Continuous breathing pulse. Reserve for focal elements only (spec §5.4). */
  glow?: boolean;
  /** Larger, more saturated treatment for the week hero ring. */
  hero?: boolean;
  /** Text under the percentage, e.g. "12 / 40". */
  caption?: string;
};

export function ProgressRing({
  percent,
  size = 104,
  strokeWidth = 8,
  glow = false,
  hero = false,
  caption,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const isComplete = clamped === 100;
  const isEmpty = clamped === 0;

  // One-shot flash the moment the ring crosses into 100% — not on every render
  // that happens to be at 100 (spec §7).
  const [flash, setFlash] = useState(false);
  const prevComplete = useRef(isComplete);

  useEffect(() => {
    if (isComplete && !prevComplete.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 620);
      prevComplete.current = isComplete;
      return () => clearTimeout(t);
    }
    prevComplete.current = isComplete;
  }, [isComplete]);

  const filterClass = flash
    ? 'frost-flash-svg'
    : isEmpty
      ? ''
      : glow || isComplete
        ? 'frost-pulse-svg'
        : hero
          ? 'frost-glow-svg-strong'
          : 'frost-glow-svg';

  const strokeColor = isComplete ? 'var(--color-frost-cyan-bright)' : 'var(--color-frost-cyan)';

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${clamped}% complete${caption ? `, ${caption}` : ''}`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden="true"
      >
        {/* Dim track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--frost-cyan-dim)"
          strokeOpacity={0.28}
          strokeWidth={strokeWidth}
        />
        {/* Progress stroke — fills clockwise from 12 o'clock */}
        <circle
          className={filterClass}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 500ms ease-out, stroke 300ms ease-out',
            // A zero-length round cap still paints a dot; hide it at 0%.
            opacity: isEmpty ? 0 : 1,
          }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`font-mono tabular-nums leading-none ${
            hero ? 'text-3xl sm:text-4xl' : 'text-lg'
          } ${isEmpty ? 'text-frost-text-dim' : 'text-frost-cyan-bright frost-glow-text'}`}
        >
          {clamped}
          <span className={hero ? 'text-xl' : 'text-xs'}>%</span>
        </span>
        {caption && (
          <span className="mt-1 font-mono text-[10px] tracking-wider text-frost-text-dim">
            {caption}
          </span>
        )}
      </div>
    </div>
  );
}
