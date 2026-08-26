/**
 * The icon library.
 *
 * Every glyph is hand-drawn path data on a 24x24 grid, stroked in
 * `currentColor` with round caps and joins — never filled, and never a colour
 * of its own. That is the whole reason these are inline paths rather than an
 * icon package: this app derives its entire palette from two colours at
 * runtime (see `lib/theme.ts`), so an icon set shipping its own hues would be
 * the one thing on screen that ignores the theme. Stroking in `currentColor`
 * means a group's mark is lit by whatever ramp tier the surrounding text uses,
 * on every preset, including the light ones.
 *
 * Monoline, to match the marks the app already draws — the task row's pencil
 * and cross were built this way, and a group icon sitting one gap away from
 * them has to read as the same set.
 *
 * `keywords` exists so the picker can be searched. Thirty-eight glyphs is
 * browsable, but "library" should mean you can ask it for a thing by name.
 */

export type IconId = string;

export type IconDef = {
  id: IconId;
  /** The accessible name, and the caption in the picker. */
  label: string;
  /** Extra search terms. The label is always searched too. */
  keywords: string;
  /** Path `d` strings, drawn in order on a 24x24 grid. */
  d: string[];
};

/**
 * Ordered in thematic runs — school, body, life, signals — so scanning the
 * grid feels like reading shelves rather than a bag of symbols.
 */
export const ICONS: IconDef[] = [
  /* ── School and work ─────────────────────────────────────────────────── */
  {
    id: 'book',
    label: 'Book',
    keywords: 'read reading study school library literature',
    d: [
      'M12 7.2C10.4 5.9 8.4 5.2 6.2 5.2H4v12h2.2c2.2 0 4.2.7 5.8 2',
      'M12 7.2c1.6-1.3 3.6-2 5.8-2H20v12h-2.2c-2.2 0-4.2.7-5.8 2',
      'M12 7.2v12',
    ],
  },
  {
    id: 'cap',
    label: 'Graduation',
    keywords: 'school university college class exam degree',
    d: [
      'M2.6 8.8 12 4.6l9.4 4.2L12 13z',
      'M6.8 10.7v4c0 1.4 2.3 2.5 5.2 2.5s5.2-1.1 5.2-2.5v-4',
      'M21.4 8.8v5',
    ],
  },
  {
    id: 'pencil',
    label: 'Writing',
    keywords: 'write essay notes homework draft journal',
    d: ['M15.8 3.1 20.9 8.2 8.1 21.1 2.1 21.9 2.9 15.9Z', 'M13.6 5.3l5.1 5.1'],
  },
  {
    id: 'flask',
    label: 'Science',
    keywords: 'chemistry lab physics biology experiment',
    d: [
      'M9.5 3.4v6.2L4.5 17.2a2 2 0 0 0 1.7 3.1h11.6a2 2 0 0 0 1.7-3.1l-5-7.6V3.4',
      'M8.2 3.4h7.6',
      'M7.1 14.4h9.8',
    ],
  },
  {
    id: 'calculator',
    label: 'Maths',
    keywords: 'math numbers algebra calculus arithmetic sums',
    d: [
      'M6.6 3.2h10.8a1.6 1.6 0 0 1 1.6 1.6v14.4a1.6 1.6 0 0 1-1.6 1.6H6.6A1.6 1.6 0 0 1 5 19.2V4.8a1.6 1.6 0 0 1 1.6-1.6z',
      'M8.4 7.2h7.2',
      'M8.8 11.6h.01',
      'M12 11.6h.01',
      'M15.2 11.6h.01',
      'M8.8 15.4h.01',
      'M12 15.4h.01',
      'M15.2 15.4h.01',
    ],
  },
  {
    id: 'globe',
    label: 'Language',
    keywords: 'world spanish french travel abroad geography earth',
    d: [
      'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z',
      'M3.4 12h17.2',
      'M12 3.4c2.3 2.5 3.5 5.4 3.5 8.6s-1.2 6.1-3.5 8.6c-2.3-2.5-3.5-5.4-3.5-8.6S9.7 5.9 12 3.4z',
    ],
  },
  {
    id: 'code',
    label: 'Code',
    keywords: 'programming software dev computer science project',
    d: ['M8.2 8.6 4 12.8l4.2 4.2', 'M15.8 8.6 20 12.8l-4.2 4.2', 'M13.6 6.2l-3.2 12.4'],
  },
  {
    id: 'palette',
    label: 'Art',
    keywords: 'paint draw design creative colour',
    d: [
      'M12 3.4a8.6 8.6 0 0 0 0 17.2c1.15 0 1.85-.85 1.85-1.75 0-.5-.2-.9-.5-1.2s-.5-.7-.5-1.2c0-1 .8-1.75 1.85-1.75h2.05A3.85 3.85 0 0 0 20.6 10.9C20.35 6.6 16.65 3.4 12 3.4z',
      'M7.8 9.6h.01',
      'M11.4 7.4h.01',
      'M15.4 9.6h.01',
      'M7.2 13.9h.01',
    ],
  },
  {
    id: 'music',
    label: 'Music',
    keywords: 'practice instrument piano guitar band song',
    d: [
      'M9.2 17.6V5.8l10-2v11.8',
      'M9.2 17.6a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0z',
      'M19.2 15.6a2.1 2.1 0 1 1-4.2 0 2.1 2.1 0 0 1 4.2 0z',
      'M9.2 9.6l10-2',
    ],
  },

  /* ── Body and rest ───────────────────────────────────────────────────── */
  {
    id: 'dumbbell',
    label: 'Strength',
    keywords: 'gym lift weights workout training exercise',
    d: ['M7 7.2v9.6', 'M3.8 9.6v4.8', 'M17 7.2v9.6', 'M20.2 9.6v4.8', 'M7 12h10'],
  },
  {
    id: 'pulse',
    label: 'Activity',
    keywords: 'run running cardio steps health fitness heartbeat',
    d: ['M2.8 12.4h4.1l2.3-6.2 4.2 12.2 2.4-6h4.4'],
  },
  {
    id: 'heart',
    label: 'Heart',
    keywords: 'love care wellbeing kindness health family',
    d: [
      'M12 20.4 4.6 13.1a4.6 4.6 0 0 1 0-6.5 4.6 4.6 0 0 1 6.5 0l.9.9.9-.9a4.6 4.6 0 0 1 6.5 0 4.6 4.6 0 0 1 0 6.5z',
    ],
  },
  {
    id: 'droplet',
    label: 'Water',
    keywords: 'hydration drink gallon litre shower wash',
    d: ['M12 3.6c-3.6 4-5.7 6.7-5.7 9.4a5.7 5.7 0 0 0 11.4 0c0-2.7-2.1-5.4-5.7-9.4z'],
  },
  {
    id: 'leaf',
    label: 'Nature',
    keywords: 'green outside walk fresh air eco',
    d: [
      'M20.4 4.2C11 4.2 4.2 8 4.2 15a5.2 5.2 0 0 0 5.2 5.2c7 0 11-6.9 11-16z',
      'M4.6 19.8 12.4 12',
    ],
  },
  {
    id: 'plant',
    label: 'Growth',
    keywords: 'habit grow progress garden long term',
    d: [
      'M12 20.6V10.4',
      'M12 11.6c0-3.8 2.5-6.3 6.3-6.3 0 3.8-2.5 6.3-6.3 6.3z',
      'M12 14.6c0-3.2-2.2-5.4-5.4-5.4 0 3.2 2.2 5.4 5.4 5.4z',
    ],
  },
  {
    id: 'moon',
    label: 'Night',
    keywords: 'sleep rest evening wind down dark',
    d: ['M20.4 14.6A8.8 8.8 0 0 1 9.4 3.6 8.8 8.8 0 1 0 20.4 14.6z'],
  },
  {
    id: 'bed',
    label: 'Sleep',
    keywords: 'rest nap bedtime wake up morning',
    d: [
      'M3 17.8V6.4',
      'M3 13h15a3 3 0 0 1 3 3v1.8',
      'M3 17.8h18',
      'M7.4 8.6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z',
      'M11.4 10.6H18',
    ],
  },
  {
    id: 'sun',
    label: 'Morning',
    keywords: 'day early sunrise wake light routine',
    d: [
      'M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z',
      'M12 2.4v2.2',
      'M12 19.4v2.2',
      'M2.4 12h2.2',
      'M19.4 12h2.2',
      'M5.2 5.2l1.6 1.6',
      'M17.2 17.2l1.6 1.6',
      'M18.8 5.2l-1.6 1.6',
      'M6.8 17.2l-1.6 1.6',
    ],
  },
  {
    id: 'sparkles',
    label: 'Care',
    keywords: 'grooming clean tidy shower skincare fresh reset',
    d: [
      'M10.6 4.2 12.15 8.45 16.4 10l-4.25 1.55L10.6 15.8 9.05 11.55 4.8 10l4.25-1.55z',
      'M17.8 14.2l.85 2.35 2.35.85-2.35.85-.85 2.35-.85-2.35-2.35-.85 2.35-.85z',
    ],
  },
  {
    id: 'cup',
    label: 'Kitchen',
    keywords: 'coffee tea cook meal eat food breakfast',
    d: [
      'M4.4 8.6h12.2v6a4.4 4.4 0 0 1-4.4 4.4H8.8a4.4 4.4 0 0 1-4.4-4.4z',
      'M16.6 10.4h1.6a2.4 2.4 0 0 1 0 4.8h-1.6',
      'M7.6 3.6v2.2',
      'M11.6 3.6v2.2',
    ],
  },

  /* ── Life and errands ────────────────────────────────────────────────── */
  {
    id: 'home',
    label: 'Home',
    keywords: 'house room chores tidy family',
    d: ['M3.4 11.2 12 4.2l8.6 7', 'M6 9.4v10.4h12V9.4'],
  },
  {
    id: 'car',
    label: 'Driving',
    keywords: 'car licence lesson commute travel road',
    d: [
      'M4.4 14.2v-2.4a2 2 0 0 1 .25-.97l2.05-3.6A2 2 0 0 1 8.44 6.2h7.12a2 2 0 0 1 1.74 1.03l2.05 3.6a2 2 0 0 1 .25.97v2.4',
      'M4.4 11.4h15.2',
      'M4.4 14.2h15.2',
      'M8.4 16a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0z',
      'M19.2 16a1.8 1.8 0 1 0-3.6 0 1.8 1.8 0 0 0 3.6 0z',
    ],
  },
  {
    id: 'cart',
    label: 'Errands',
    keywords: 'shop shopping buy groceries store list',
    d: [
      'M2.8 4.4h2.6l2.5 11.1a1.6 1.6 0 0 0 1.56 1.25h7.9a1.6 1.6 0 0 0 1.56-1.22L21 8.6H6.2',
      'M10.4 20.2a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 0 0 2.8 0z',
      'M18.6 20.2a1.4 1.4 0 1 0-2.8 0 1.4 1.4 0 0 0 2.8 0z',
    ],
  },
  {
    id: 'coin',
    label: 'Money',
    keywords: 'budget save pay bills insurance finance',
    d: [
      'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z',
      'M12 6.8v10.4',
      'M14.7 9.5a2.9 2.9 0 0 0-2.7-1.5c-1.5 0-2.7.9-2.7 2.1s1.2 1.9 2.7 2.2 2.7.9 2.7 2.2-1.2 2.1-2.7 2.1a2.9 2.9 0 0 1-2.7-1.5',
    ],
  },
  {
    id: 'briefcase',
    label: 'Work',
    keywords: 'job shift office career business',
    d: [
      'M4.4 8h15.2a1.4 1.4 0 0 1 1.4 1.4v9.2a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 18.6V9.4A1.4 1.4 0 0 1 4.4 8z',
      'M9 8V6.2a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 6.2V8',
      'M3 13.2h18',
    ],
  },
  {
    id: 'folder',
    label: 'Admin',
    keywords: 'files paperwork forms documents sort',
    d: [
      'M3.4 7.6a1.6 1.6 0 0 1 1.6-1.6h3.7l1.8 2.2h8.5a1.6 1.6 0 0 1 1.6 1.6v8.6a1.6 1.6 0 0 1-1.6 1.6H5a1.6 1.6 0 0 1-1.6-1.6z',
    ],
  },
  {
    id: 'plane',
    label: 'Travel',
    keywords: 'trip holiday flight away journey',
    d: ['M21.2 3 10.6 13.6', 'M21.2 3l-6.8 18.2-3.8-7.6-7.6-3.8z'],
  },
  {
    id: 'people',
    label: 'People',
    keywords: 'friends family social meet team call',
    d: [
      'M9.4 11.6a3.6 3.6 0 1 0 0-7.2 3.6 3.6 0 0 0 0 7.2z',
      'M2.8 20.4a6.6 6.6 0 0 1 13.2 0',
      'M16.6 5a3.6 3.6 0 0 1 0 6.4',
      'M18 14.6a6.6 6.6 0 0 1 3.2 5.8',
    ],
  },
  {
    id: 'chat',
    label: 'Message',
    keywords: 'reply email text contact ask',
    d: [
      'M20.6 14.4a1.9 1.9 0 0 1-1.9 1.9H8.2L4.4 20.1V6.1a1.9 1.9 0 0 1 1.9-1.9h12.4a1.9 1.9 0 0 1 1.9 1.9z',
    ],
  },
  {
    id: 'bell',
    label: 'Reminder',
    keywords: 'alert notify deadline due remember',
    d: [
      'M18.2 16.6H5.8c1.35-1.45 1.75-2.4 1.75-5.1V10a4.45 4.45 0 0 1 8.9 0v1.5c0 2.7.4 3.65 1.75 5.1z',
      'M10.1 19.2a2.1 2.1 0 0 0 3.8 0',
    ],
  },
  {
    id: 'calendar',
    label: 'Calendar',
    keywords: 'date appointment schedule plan booking',
    d: [
      'M5.4 6.2h13.2a1.6 1.6 0 0 1 1.6 1.6v11.6a1.6 1.6 0 0 1-1.6 1.6H5.4a1.6 1.6 0 0 1-1.6-1.6V7.8a1.6 1.6 0 0 1 1.6-1.6z',
      'M3.8 10.8h16.4',
      'M8.4 3.6v4.4',
      'M15.6 3.6v4.4',
    ],
  },
  {
    id: 'clock',
    label: 'Time',
    keywords: 'timer deadline hour minutes session',
    d: ['M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z', 'M12 7.2V12l3.4 2'],
  },

  /* ── Signals ─────────────────────────────────────────────────────────── */
  {
    id: 'star',
    label: 'Star',
    keywords: 'important favourite priority special best',
    d: [
      'M12 3.6l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 17.13l-5.3 2.79 1.01-5.9L3.42 9.83l5.93-.86z',
    ],
  },
  {
    id: 'flag',
    label: 'Goal',
    keywords: 'milestone finish objective aim',
    d: ['M5.8 21V4', 'M5.8 4.8h12.4l-2.4 3.7 2.4 3.7H5.8'],
  },
  {
    id: 'target',
    label: 'Focus',
    keywords: 'aim precise deep work concentrate bullseye',
    d: [
      'M12 3.4a8.6 8.6 0 1 0 0 17.2 8.6 8.6 0 0 0 0-17.2z',
      'M12 7.7a4.3 4.3 0 1 0 0 8.6 4.3 4.3 0 0 0 0-8.6z',
      'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z',
    ],
  },
  {
    id: 'bolt',
    label: 'Energy',
    keywords: 'quick fast urgent power boost',
    d: ['M13.6 2.6 4.8 13.6h6.2L10.4 21.4l8.8-11h-6.2z'],
  },
  {
    id: 'check',
    label: 'Done',
    keywords: 'complete finish tick simple general',
    d: ['M4.4 12.6 9.6 17.8 19.6 6.6'],
  },
  {
    id: 'tag',
    label: 'Tag',
    keywords: 'label group category other misc',
    d: [
      'M11.1 3.6H4.8a1.2 1.2 0 0 0-1.2 1.2v6.3a1.2 1.2 0 0 0 .35.85l8.5 8.5a1.2 1.2 0 0 0 1.7 0l6.3-6.3a1.2 1.2 0 0 0 0-1.7l-8.5-8.5a1.2 1.2 0 0 0-.85-.35z',
      'M8.3 7.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
    ],
  },
];

/** What a new group starts as, and the fallback for an id we no longer ship. */
export const DEFAULT_ICON: IconId = 'tag';

const BY_ID = new Map(ICONS.map((icon) => [icon.id, icon]));

/**
 * Never throws and never returns nothing: an id written by a build that
 * shipped a glyph we have since dropped still has to render *something* next
 * to the task, or a group silently loses its mark on one device and keeps it
 * on another.
 */
export function iconById(id: string | null | undefined): IconDef {
  return (id ? BY_ID.get(id) : undefined) ?? BY_ID.get(DEFAULT_ICON)!;
}

export function isKnownIcon(id: unknown): id is IconId {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Label first, then keywords. An empty query returns the whole library. */
export function searchIcons(query: string): IconDef[] {
  const q = query.trim().toLowerCase();
  if (!q) return ICONS;
  return ICONS.filter(
    (icon) => icon.label.toLowerCase().includes(q) || icon.keywords.includes(q),
  );
}
