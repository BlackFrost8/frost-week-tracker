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
    id: 'nature',
    name: 'Nature',
    note: 'deep forest, new growth',
    /* #4ade80 was the obvious green and derived a `cyan-500` of 4.30 against
       its own canvas — under the 4.5 floor for text, and that tier carries
       `today`, `clear checks` and the panel labels. Lifted until it clears. */
    spec: { primary: '#0a1410', accent: '#57e88f' },
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

  /* Three tiers, and all three are text — so all three have to clear 4.5:1
     against the *worst* thing they sit on, which is surface-2 rather than the
     canvas. The faint tier did not come close: 2.58–2.91 across the presets,
     below even the 3:1 floor for non-text. It was not carrying decoration
     either — `+ add task`, the suggestion buttons, "nothing planned yet", the
     week strip's dates and the intent panel's three prompts are all faint, so
     the app's primary verb and its most personal question were its least
     legible type.
     Raising faint alone would have landed it on top of dim (both ≈5:1) and
     collapsed three tiers into two, so the ladder is re-spaced instead: even
     steps of roughly 1.7× contrast, measured on surface-2, worst preset —
     text ≈12.5–14.6, dim ≈7.5–8.8, faint ≈4.5–5.2. The factors below are the
     smallest that hold those floors across all five presets in both
     directions; see the tint amounts, which are unchanged. */
  const text = tint(mix(base, far, light ? 0.92 : 0.9), 0.04);
  const textDim = tint(mix(base, far, light ? 0.73 : 0.69), 0.07);
  const textFaint = tint(mix(base, far, light ? 0.59 : 0.5), 0.09);

  // Black on a bright accent, white on a dark one. The 1.2 bias breaks ties
  // towards white: a saturated mid-tone like #2f6df6 scores 4.60 against black
  // and 4.56 against white — a rounding error numerically, but black on blue
  // reads muddy and white on blue is what every real UI does.
  const onAccent = contrast(accent, BLACK) >= contrast(accent, WHITE) * 1.2 ? BLACK : WHITE;

  /* The 300 and 500 tiers are TEXT, not decoration: the intent-panel labels,
     the week arrows, the "today" jump-back, the clock's controls.

     Mixing them toward the canvas dims them, which is what you want — but
     "dimmer" only means "darker" when the canvas is dark. On a pale theme the
     same mix walks a mid-blue *up* into the background: the Office preset
     measured 2.20:1 and 3.18:1 against its own canvas, well under the 4.5
     needed to read. They mix away from the canvas when it is light, which is
     the only direction that dims a colour against white.

     The 700/900/950 tiers are deliberately left alone — those are fills and
     ring tracks, and they have to stay close to the canvas to be quiet. */
  const ink = light ? far : base;

  return {
    '--color-frost-black': rgbToHex(base),
    '--color-frost-void': rgbToHex(mix(base, far, 0.02)),
    '--color-frost-surface': rgbToHex(mix(base, far, 0.045)),
    '--color-frost-surface-2': rgbToHex(mix(base, far, 0.075)),

    '--color-frost-cyan-050': rgbToHex(mix(accent, light ? BLACK : WHITE, 0.7)),
    '--color-frost-cyan-100': rgbToHex(mix(accent, light ? BLACK : WHITE, 0.16)),
    '--color-frost-cyan-200': rgbToHex(accent),
    '--color-frost-cyan-300': rgbToHex(mix(accent, ink, 0.18)),
    '--color-frost-cyan-500': rgbToHex(mix(accent, ink, 0.42)),
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

  // The browser's own chrome on a phone. Hardcoded black in the HTML, which
  // put a black bar above a near-white page on the light presets.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', vars['--color-frost-black']);
}

/* ── Persistence ───────────────────────────────────────────────────────────
   Device-local on purpose. A theme is about the screen in front of you and the
   room it's in — the same reasoning that keeps the timer local. You might well
   want Office on a bright school Chromebook and Frost at night. */

const KEY = 'frost-week-tracker:theme:v1';

/** The name is also the wordmark: naming your own theme renames the app. */
export type StoredTheme = { presetId: string | null; name: string; spec: ThemeSpec };

export const MAX_THEME_NAME = 18;

const DEFAULT_STORED: StoredTheme = {
  presetId: DEFAULT_PRESET_ID,
  name: PRESETS[0].name,
  spec: DEFAULT_SPEC,
};

export function loadTheme(): StoredTheme {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STORED;
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    const primary = parsed.spec?.primary;
    const accent = parsed.spec?.accent;
    if (typeof primary === 'string' && typeof accent === 'string') {
      const name =
        typeof parsed.name === 'string' && parsed.name.trim()
          ? parsed.name.trim().slice(0, MAX_THEME_NAME)
          : DEFAULT_STORED.name;
      return { presetId: parsed.presetId ?? null, name, spec: { primary, accent } };
    }
  } catch {
    /* Fall through to the default. */
  }
  return DEFAULT_STORED;
}

export function saveTheme(stored: StoredTheme): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    /* Private mode — the theme just won't survive a reload. */
  }
}
