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

/* Kept plain on purpose. These are read in a fraction of a second, out of the
   corner of the eye, by someone who has not decided what to write yet — so
   each one has to be a thing you obviously either do or don't do. Anything
   that needs a beat to parse is doing the opposite of its job. */
const POOL: string[] = [
  'Finish your homework',
  'Revise for 30 minutes',
  'Read a chapter',
  'Tidy your room',
  'Go for a run',
  'Drink more water',
  'Call home',
  'Do the washing up',
  'Take the bins out',
  'Pack your bag for tomorrow',
  'Make your bed',
  'Go to bed early',
  'Stretch for ten minutes',
  'Reply to your messages',
  'Plan tomorrow',
  'Back up your notes',
  'Clear your desk',
  'Get some fresh air',
  'Practise your instrument',
  'Check your timetable',
  'Do your laundry',
  'Cook a proper meal',
  'Charge your devices',
  'Go over today’s notes',
  'Start your assignment',
  'Take a proper break',
  'Water the plants',
  'Sort out your folders',
  'Write down three good things',
  'Put your phone away for an hour',
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
 * One prompt that has never been shown, marked as shown.
 *
 * Returns null once the pool runs down, which is the intended end state: by
 * then you know what the card is for, and an empty day should just be empty.
 */
export function takePrompt(): string | null {
  const seen = readSeen();
  const fresh = POOL.filter((p) => !seen.has(p));
  if (fresh.length === 0) return null;

  const picked = fresh[Math.floor(Math.random() * fresh.length)];
  seen.add(picked);
  writeSeen(seen);
  return picked;
}
