/**
 * Themes are two colours and some arithmetic.
 *
 * The design system already spends everything through a small set of tokens —
 * a base ramp (black → surface-2), an accent ramp (050 → 950) and three text
 * tiers. So a theme doesn't need thirteen hand-picked values; it needs a
 * PRIMARY (the canvas) and an ACCENT (the spotlight), and the rest can be
 * derived. That's what makes "advanced: pick your own two colours" produce a
 * coherent screen rather than a paint spill.
 *
 * Deriving also means light themes work for free: every text tier is mixed
 * *towards the far end of the canvas*, so on a pale primary the ink goes dark
 * instead of white without a single `if (light)` in a component.
 */

export type ThemeSpec = { primary: string; accent: string };

export type Preset = {
  id: string;
  name: string;
  /** Shown under the name in the picker. */
  note: string;
  spec: ThemeSpec;
};

export const PRESETS: Preset[] = [
  {
    id: 'frost',
    name: 'Frost',
    note: 'true black, cyan spotlight',
    spec: { primary: '#000000', accent: '#00efff' },
  },
  {
    id: 'august',
    name: 'August',
    note: 'late summer, low sun',
    spec: { primary: '#0f0a06', accent: '#ff9f45' },
  },
  {
    id: 'monochrome',
    name: 'Monochrome',
    note: 'no colour at all',
    spec: { primary: '#050505', accent: '#e4e4e4' },
  },
  {
    id: 'office',
    name: 'Office',
    note: 'paper white, ink blue',
    spec: { primary: '#f4f6f8', accent: '#2f6df6' },
  },
  {
    id: 'coffee',
    name: 'Coffee',
    note: 'dark roast, warm crema',
    spec: { primary: '#150f0b', accent: '#c98a52' },
  },
];

export const DEFAULT_PRESET_ID = 'frost';
export const DEFAULT_SPEC: ThemeSpec = PRESETS[0].spec;

/* ── Colour maths ──────────────────────────────────────────────────────────
   Deliberately plain sRGB mixing. Perceptual (OKLab) blending would be more
   correct, but this runs on every theme change and the inputs are already
   arbitrary user colours — the extra precision buys nothing visible here. */

type RGB = [number, number, number];

const clamp255 = (n: number) => Math.max(0, Math.min(255, Math.round(n)));

export function hexToRgb(hex: string): RGB {
  let h = hex.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(h)) return [0, 0, 0];
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

export function rgbToHex([r, g, b]: RGB): string {
  return `#${[r, g, b].map((n) => clamp255(n).toString(16).padStart(2, '0')).join('')}`;
}

/** t = 0 returns a, t = 1 returns b. */
function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t].map(
    clamp255,
  ) as RGB;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance([r, g, b]: RGB): number {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(a: RGB, b: RGB): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const triplet = ([r, g, b]: RGB) => `${r} ${g} ${b}`;

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

export function isLight(primary: string): boolean {
  return luminance(hexToRgb(primary)) > 0.35;
}

/**
 * The whole token set, as CSS custom properties. Keys match the names the app
 * already uses, so nothing downstream has to know themes exist.
 */
export function deriveTheme(spec: ThemeSpec): Record<string, string> {
  const base = hexToRgb(spec.primary);
  const accent = hexToRgb(spec.accent);
  const light = luminance(base) > 0.35;

  // Everything reads *away* from the canvas: up on a dark theme, down on a
  // light one. One flag, and every tier below follows.
  const far = light ? BLACK : WHITE;

  // A hair of accent in the text is what stops a theme reading as grey-on-grey.
  const tint = (c: RGB, t = 0.05) => mix(c, accent, t);

  const text = tint(mix(base, far, light ? 0.92 : 0.9), 0.04);
  const textDim = tint(mix(base, far, light ? 0.62 : 0.52), 0.07);
  const textFaint = tint(mix(base, far, light ? 0.42 : 0.32), 0.09);

  // Black on a bright accent, white on a dark one. The 1.2 bias breaks ties
  // towards white: a saturated mid-tone like #2f6df6 scores 4.60 against black
  // and 4.56 against white — a rounding error numerically, but black on blue
  // reads muddy and white on blue is what every real UI does.
  const onAccent = contrast(accent, BLACK) >= contrast(accent, WHITE) * 1.2 ? BLACK : WHITE;

  return {
    '--color-frost-black': rgbToHex(base),
    '--color-frost-void': rgbToHex(mix(base, far, 0.02)),
    '--color-frost-surface': rgbToHex(mix(base, far, 0.045)),
    '--color-frost-surface-2': rgbToHex(mix(base, far, 0.075)),

    '--color-frost-cyan-050': rgbToHex(mix(accent, light ? BLACK : WHITE, 0.7)),
    '--color-frost-cyan-100': rgbToHex(mix(accent, light ? BLACK : WHITE, 0.16)),
    '--color-frost-cyan-200': rgbToHex(accent),
    '--color-frost-cyan-300': rgbToHex(mix(accent, base, 0.18)),
    '--color-frost-cyan-500': rgbToHex(mix(accent, base, 0.42)),
    '--color-frost-cyan-700': rgbToHex(mix(accent, base, 0.68)),
    '--color-frost-cyan-900': rgbToHex(mix(accent, base, 0.86)),
    '--color-frost-cyan-950': rgbToHex(mix(accent, base, 0.96)),

    '--color-frost-text': rgbToHex(text),
    '--color-frost-text-dim': rgbToHex(textDim),
    '--color-frost-text-faint': rgbToHex(textFaint),
    '--color-frost-alert': light ? '#c0233c' : '#ff5d73',

    // Triplets, for the places that need `rgb(… / alpha)` rather than a hex.
    '--frost-accent-rgb': triplet(accent),
    '--frost-base-rgb': triplet(base),
    '--frost-far-rgb': triplet(far),
    '--frost-on-accent': rgbToHex(onAccent),

    '--frost-hairline': light ? 'rgba(0, 0, 0, 0.10)' : 'rgba(255, 255, 255, 0.06)',
    '--frost-scheme': light ? 'light' : 'dark',
  };
}

export function applyTheme(spec: ThemeSpec): void {
  const root = document.documentElement;
  const vars = deriveTheme(spec);
  for (const [key, value] of Object.entries(vars)) root.style.setProperty(key, value);
  root.style.colorScheme = vars['--frost-scheme'];
}

/* ── Persistence ───────────────────────────────────────────────────────────
   Device-local on purpose. A theme is about the screen in front of you and the
   room it's in — the same reasoning that keeps the timer local. You might well
   want Office on a bright school Chromebook and Frost at night. */

const KEY = 'frost-week-tracker:theme:v1';

export type StoredTheme = { presetId: string | null; spec: ThemeSpec };

export function loadTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { presetId: DEFAULT_PRESET_ID, spec: DEFAULT_SPEC };
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    const primary = parsed.spec?.primary;
    const accent = parsed.spec?.accent;
    if (typeof primary === 'string' && typeof accent === 'string') {
      return { presetId: parsed.presetId ?? null, spec: { primary, accent } };
    }
  } catch {
    /* Fall through to the default. */
  }
  return { presetId: DEFAULT_PRESET_ID, spec: DEFAULT_SPEC };
}

export function saveTheme(stored: StoredTheme): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* Private mode — the theme just won't survive a reload. */
  }
}

/** Called before React mounts so the first paint is already the right colour. */
export function applyStoredTheme(): void {
  applyTheme(loadTheme().spec);
}
