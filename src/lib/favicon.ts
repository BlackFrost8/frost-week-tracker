/**
 * The tab icon, redrawn as the week fills up.
 *
 * The static file in `public/` is a ring frozen at one arbitrary percentage in
 * one hardcoded colour — fine as the thing that ships in the HTML, wrong the
 * moment the app knows the real number or the user picks a different accent.
 * This overwrites it at runtime with the actual week total.
 *
 * A canvas rather than an inline SVG data URI: SVG favicons are still refused
 * or quietly ignored by some browsers, and a 64px PNG is understood by all of
 * them. It costs one small draw per change, and changes are rare — a task has
 * to be checked off, or a theme chosen.
 */

const SIZE = 64;
const CENTRE = SIZE / 2;
const RADIUS = 19;
const STROKE = 6;

/** Reused across redraws so the tab doesn't accumulate a link per repaint. */
let iconLink: HTMLLinkElement | null = null;

function ensureLink(): HTMLLinkElement {
  if (iconLink?.isConnected) return iconLink;

  // Prefer the one already in index.html so the static favicon is replaced
  // rather than competing with it — browsers pick unpredictably between two.
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  const link = existing ?? document.createElement('link');
  link.rel = 'icon';
  if (!existing) document.head.appendChild(link);

  iconLink = link;
  return link;
}

/**
 * `pct` is the whole week, 0–100. `accent` and `base` are the theme's two
 * colours, so the icon reads as the same app as the page behind it.
 */
export function paintFavicon(pct: number, accent: string, base: string): void {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) return; // Canvas disabled: the static icon stays, which is fine.

  // Rounded like an app tile. `roundRect` is recent enough to still be worth
  // a guard; a square tile is a perfectly good fallback.
  ctx.fillStyle = base;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(0, 0, SIZE, SIZE, 14);
    ctx.fill();
  } else {
    ctx.fillRect(0, 0, SIZE, SIZE);
  }

  ctx.lineWidth = STROKE;
  ctx.strokeStyle = accent;

  // The track. Faint, but present at 0% — an icon with no ring at all reads as
  // a broken image rather than as an empty week.
  ctx.globalAlpha = 0.25;
  ctx.beginPath();
  ctx.arc(CENTRE, CENTRE, RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const fraction = Math.max(0, Math.min(100, pct)) / 100;
  if (fraction > 0) {
    ctx.lineCap = 'round';
    ctx.beginPath();
    // From twelve o'clock, clockwise, matching the ring on the page.
    ctx.arc(CENTRE, CENTRE, RADIUS, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * fraction);
    ctx.stroke();
  }

  ensureLink().href = canvas.toDataURL('image/png');
}
