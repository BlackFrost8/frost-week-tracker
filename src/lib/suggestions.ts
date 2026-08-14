/**
 * Prompts for an empty day.
 *
 * A new account starts with nothing planned, which is correct — a routine you
 * didn't choose is someone else's routine, and five tasks you have to delete
 * are worse than none. But a blank card also tells you nothing about what the
 * app is for, so an empty day offers a few greyed prompts instead. They are
 * suggestions, not content: none of this is saved anywhere until you click one.
 *
 * Each is shown at most once, ever. A prompt you've already read has done its
 * job, and seeing it a second time makes the app look like it is nagging.
 */

const POOL: string[] = [
  'Read 20 pages',
  'Review today’s notes',
  'Pack your bag for tomorrow',
  'Drink 2L of water',
  'Go for a walk',
  'Tidy your desk',
  'Plan tomorrow in five minutes',
  'Stretch for ten minutes',
  'Check the homework diary',
  'Start the essay draft',
  'Practise an instrument',
  'Inbox to zero',
  'Make your bed',
  'Cook something proper',
  'Reread one set of flashcards',
  'Get outside before dark',
  'Message someone back',
  'Wash up before bed',
  'Lay out clothes for the morning',
  'Do one past paper question',
  'Back up your notes',
  'Screen off an hour before sleep',
  'Sort one folder out',
  'Write down what went well',
  'Sit down and do nothing for five minutes',
  'Top up your water bottle',
  'Charge everything overnight',
  'Read something that isn’t for school',
  'Fix the one thing you keep putting off',
  'Ask about the thing you didn’t understand',
];

/* Device-local, like the theme and the timer. This is about the screen in
   front of you rather than about your content, and syncing it would mean a
   database write every time a card was merely looked at. */
const KEY = 'frost-week-tracker:prompts-seen:v1';

function readSeen(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string') : []);
  } catch {
    return new Set();
  }
}

function writeSeen(seen: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...seen]));
  } catch {
    /* Private mode or quota — prompts just repeat, which is survivable. */
  }
}

/**
 * Up to `count` prompts that have never been shown, marked as shown.
 *
 * Returns fewer than asked, or none at all, as the pool runs down. That is the
 * intended end state: once you've seen them you know what the card does, and
 * an empty day should be empty.
 */
export function takePrompts(count: number): string[] {
  const seen = readSeen();
  const fresh = POOL.filter((p) => !seen.has(p));
  if (fresh.length === 0) return [];

  // Fisher–Yates over a copy, so the order varies per day rather than always
  // walking the list from the top.
  const pool = [...fresh];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const picked = pool.slice(0, count);
  for (const p of picked) seen.add(p);
  writeSeen(seen);
  return picked;
}
