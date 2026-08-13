import { useMemo } from 'react';

/**
 * 30 was too few to register, but count alone was never the problem — the old
 * field was uniformly 1-2px dots of a 2.7:1 colour at 0.18-0.58 alpha, which is
 * below the perceptual floor however many you draw. 80 at a raised opacity
 * floor, with one in five allowed to be genuinely visible, is what makes it
 * read as depth.
 *
 * These are absolutely positioned spans animating only transform and opacity,
 * so each is its own compositor layer and costs nothing on the CPU. 110 layers
 * is comfortable on a decade-old integrated GPU. Past ~250 a canvas rewrite
 * would start to pay for itself, and the field would read as a starfield
 * rather than as dust — that is the real ceiling, not performance.
 */
const MOTE_COUNT = 110;

/** One in five. Enough to catch the eye, few enough to still be atmosphere. */
const BRIGHT_EVERY = 5;

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
        const bright = i % BRIGHT_EVERY === 0;
        return {
          key: i,
          bright,
          size: bright ? 2 : Math.random() < 0.75 ? 1 : 2,
          left: Math.random() * 100,
          top: Math.random() * 100,
          // Small, mostly-upward drift so it reads as settling dust, not snow.
          // Roughly 1.5x the previous rate — enough to register as movement
          // rather than as a still image, while staying well short of weather.
          dx: `${(Math.random() - 0.5) * 140}px`,
          dy: `${-50 - Math.random() * 160}px`,
          duration: 11 + Math.random() * 19,
          delay: -Math.random() * 30,
          opacity: bright ? 0.55 + Math.random() * 0.35 : 0.14 + Math.random() * 0.22,
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
          className={m.bright ? 'frost-mote frost-mote--bright' : 'frost-mote'}
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
