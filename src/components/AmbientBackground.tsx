import { useMemo } from 'react';

const MOTE_COUNT = 30;

/**
 * The fixed atmosphere layer (§2.5): true black, one off-centre cyan wash, and
 * a field of slow drifting dust motes.
 *
 * Motes are generated once per mount so they don't reshuffle on every render,
 * and each carries its own drift vector, duration and delay — a uniform
 * animation would read as a visible "effect" rather than atmosphere.
 */
export function AmbientBackground() {
  const motes = useMemo(
    () =>
      Array.from({ length: MOTE_COUNT }, (_, i) => {
        const size = Math.random() < 0.75 ? 1 : 2;
        return {
          key: i,
          size,
          left: Math.random() * 100,
          top: Math.random() * 100,
          // Small, mostly-upward drift so it reads as settling dust, not snow.
          dx: `${(Math.random() - 0.5) * 120}px`,
          dy: `${-40 - Math.random() * 140}px`,
          duration: 15 + Math.random() * 25,
          delay: -Math.random() * 30,
          opacity: 0.18 + Math.random() * 0.4,
        };
      }),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="frost-vignette" />
      {motes.map((m) => (
        <span
          key={m.key}
          className="frost-mote"
          style={
            {
              width: m.size,
              height: m.size,
              left: `${m.left}%`,
              top: `${m.top}%`,
              animationDuration: `${m.duration}s`,
              animationDelay: `${m.delay}s`,
              '--mote-dx': m.dx,
              '--mote-dy': m.dy,
              '--mote-opacity': m.opacity,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
