import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { DAY_IDS, DAY_SHORT } from '../lib/week';
import { TaskIcon } from './TaskIcon';

/**
 * A screen the tour opens for itself, and keeps open for as long as that step
 * lasts. `App` owns the actual dialogs; this is only the request.
 */
export type TourStage = 'group' | 'theme';

/**
 * One card, and the thing on the page it is talking about.
 *
 * `target` is a `[data-tour]` key rather than a class or an id: it names the
 * element for this purpose only, so restyling a panel cannot silently break
 * the tour, and the attribute sitting in the markup tells the next person that
 * something points at it. `null` is a card with nothing to point at.
 */
type Step = {
  target: string | null;
  stage?: TourStage;
  title: string;
  body: string;
  /** The opening card, which is the one card with nothing to point at and
      the whole screen to say it in. */
  hero?: true;
  /** A still of a screen the tour cannot honestly open on a new account. */
  preset?: 'standing';
};

/**
 * The tour, in the order the app is actually used: the week, then the day,
 * then why the week is what it is, then how the work gets sorted, then
 * everything around it.
 *
 * Every card is short on purpose. This is read once, by somebody who has not
 * yet decided whether to stay, so anything that does not change what they can
 * do belongs in the info dialog instead: one click away, and always there.
 */
const STEPS: Step[] = [
  {
    target: null,
    title: 'Welcome to the Frost Weekly Planner',
    body: 'A highly functional, smooth digital tool awaits at your fingertips, should you learn the different features of this Planner. This tutorial doesn’t take long and you can leave at any point.',
    hero: true,
  },
  {
    target: 'week',
    title: 'The week',
    body: 'Every day is here at once. Choose one to work on it. The bar under each day is how much of that day is done.',
  },
  {
    target: 'day',
    title: 'The day',
    body: 'The day you chose, and everything on it. Enter saves a task and opens the next line, so a list can be written straight through. Hover a task for its controls: file it in a group, rename it, send it to another day, or remove it.',
  },
  {
    target: 'intent',
    title: 'Why you choose order this week',
    body: 'Your focus, reward, and affirmation all in plain view to keep reminding you why you do this. Use this to keep moving forward. Resets every week for a fresh perspective.',
  },
  {
    target: 'groups',
    title: 'Groups and goals',
    body: 'Sort the tasks into different categories such as school or training, and each one tracks its own share of the week. Open a group to see everything in it including upcoming tasks that were planned ahead. Below them sits the goals which reflects your more long-term aspirations.',
  },
  {
    target: 'group-dialog',
    stage: 'group',
    title: 'Making a group',
    body: 'Creating a new group gives you the option to choose a visual label, which then gets displayed next to your tasks so they can be differentiated easier, the labeled task also shows up in the group section for easier access.',
  },
  {
    target: null,
    preset: 'standing',
    title: 'Standing tasks',
    body: 'In the profile section after an account was made; there you can make a list of tasks that gets repeated frequently, and you can choose the days they show up in the week.',
  },
  {
    target: 'chrome',
    title: 'The rest of it',
    body: 'The arrows move between weeks so you can plan ahead and there is a timer that can be toggled to a stopwatch when clicked on. Sign in to save your progress.',
  },
  {
    target: 'theme-dialog',
    stage: 'theme',
    title: 'Themes',
    body: 'If you do not like the Frost theme, you can choose from the 4 other color presets or even choose your own color scheme paired with a name so this Domain of Order can truly feel like it belongs to you.',
  },
];

/** A rectangle in the page's own coordinates, which is not always the screen's. */
type Rect = { top: number; left: number; width: number; height: number };

/** The large-display scale on `:root`, or 1 on every ordinary screen. */
function pageZoom(): number {
  return (
    Number(getComputedStyle(document.documentElement).getPropertyValue('--frost-zoom')) || 1
  );
}

/**
 * The element's box, divided back out of that zoom.
 *
 * `getBoundingClientRect` reports the scaled result, and anything positioned
 * inside the scaled root is scaled again on the way out. Without the divide,
 * the spotlight on a 4K screen lands at roughly twice the distance from the
 * corner as the thing it is meant to be lighting. Same correction `Clock.tsx`
 * makes to its `vw` sizing.
 */
function measure(el: Element): Rect {
  const zoom = pageZoom();
  const r = el.getBoundingClientRect();
  return { top: r.top / zoom, left: r.left / zoom, width: r.width / zoom, height: r.height / zoom };
}

const settled = (a: Rect, b: Rect) =>
  Math.abs(a.top - b.top) < 0.5 &&
  Math.abs(a.left - b.left) < 0.5 &&
  Math.abs(a.width - b.width) < 0.5 &&
  Math.abs(a.height - b.height) < 0.5;

/**
 * One frame of the light moving from where it is to where it belongs.
 *
 * The hole is a path now rather than a box, and a path cannot be handed to a
 * CSS transition, so the easing happens here. It earns its keep within a
 * single step too: the opening scroll is smooth, and the light follows it
 * instead of arriving before it.
 */
function glide(from: Rect, to: Rect): Rect {
  if (settled(from, to)) return to;
  const k = 0.3;
  return {
    top: from.top + (to.top - from.top) * k,
    left: from.left + (to.left - from.left) * k,
    width: from.width + (to.width - from.width) * k,
    height: from.height + (to.height - from.height) * k,
  };
}

/** Padding around the lit element, so it is framed rather than cropped. */
const HALO = 10;
const RADIUS = 18;

/** The card at full width, the narrowest it is still worth reading at, the
    shortest band worth docking into, and the clearance it keeps from whatever
    it sits beside. */
const CARD = 416;
/* The opening card only. It points at nothing, so the whole screen is its to
   use, and it is the one card read before anybody has decided to stay. */
const HERO = 560;
const MIN_CARD = 300;
const MIN_BAND = 200;
const GAP = 24;

/**
 * Where the card goes, given what is lit.
 *
 * Beside the light wherever there is room for it, which is the only placement
 * that leaves the lit thing entirely usable — and the lit thing is meant to be
 * used. The dialogs the tour opens are the case that forces this: they are
 * centred and tall, so a card docked under one covers its buttons, and the
 * step inviting you to name a group would be sitting on the button that keeps
 * it.
 *
 * Above or below is the fallback for a target too wide to sit beside, and the
 * end it picks is the one the target is not at.
 */
type Dock = 'centre' | 'top' | 'bottom' | 'left' | 'right' | 'corner';

function placeFor(
  hole: Rect | null,
  vw: number,
  vh: number,
  cap = CARD,
): { dock: Dock; width: number } {
  const full = Math.min(cap, vw - GAP * 2);
  if (!hole) return { dock: 'centre', width: full };

  /* Whichever side has more room gets first refusal, and the card narrows to
     fit it. A 300px card beside the day is worth more than a full-width one
     sitting on top of it. */
  const before = hole.left - HALO - GAP * 2;
  const after = vw - (hole.left + hole.width + HALO) - GAP * 2;
  const roomier = after > before ? 'right' : 'left';
  const side = Math.max(before, after);
  if (side >= MIN_CARD) return { dock: roomier, width: Math.min(CARD, side) };

  // Then the band above or below, but only if a whole card fits in it.
  const above = hole.top - HALO - GAP * 2;
  const below = vh - (hole.top + hole.height + HALO) - GAP * 2;
  if (Math.max(above, below) >= MIN_BAND) {
    return { dock: below > above ? 'bottom' : 'top', width: full };
  }

  /* Nothing fits anywhere, which is a dialog taller than the screen it is on.
     The corner is what is left, and it is the top right because the bottom of
     a dialog is where its buttons are. */
  return { dock: 'corner', width: full };
}

/**
 * How tall the card may be where it has been docked.
 *
 * Above or below the light it gets that band and no more, so it cannot sit on
 * the thing it is describing. `placeFor` picks those two docks only when the
 * band is worth having, so there is no floor to apply here. The card's text
 * scrolls inside it; the buttons below it never do.
 */
function maxCardHeight(dock: Dock, hole: Rect | null, vh: number): number {
  const full = vh - GAP * 2;
  if (!hole || (dock !== 'top' && dock !== 'bottom')) return full;
  const band =
    dock === 'top'
      ? hole.top - HALO - GAP * 2
      : vh - (hole.top + hole.height + HALO) - GAP * 2;
  return Math.min(full, band);
}

/* Inline rather than utility classes: the dock is chosen in JS from a measured
   box and `GAP`, so its offsets and the translate that pairs with them belong
   in the same place as the decision. Each entry sets both axes of `translate`,
   which is the part a class-per-axis version leaves to inheritance. */
const DOCK_STYLE: Record<Dock, CSSProperties> = {
  centre: { left: '50%', top: '50%', translate: '-50% -50%' },
  top: { left: '50%', top: GAP, translate: '-50% 0' },
  bottom: { left: '50%', bottom: GAP, translate: '-50% 0' },
  left: { left: GAP, top: '50%', translate: '0 -50%' },
  right: { right: GAP, top: '50%', translate: '0 -50%' },
  corner: { right: GAP, top: GAP, translate: '0 0' },
};

/**
 * The dim, as one path with a hole in it.
 *
 * A path is what makes the lit area genuinely usable: hit testing follows the
 * fill, so a click inside the hole reaches the app underneath while every
 * click outside it is caught here. Four rectangles around the hole cannot have
 * rounded corners, and the `box-shadow` version tests as the exact inverse of
 * what is wanted, since a shadow is painted outside a border box that is
 * itself the hole.
 *
 * The outer ring is deliberately far larger than any viewport: the `<svg>`
 * clips it, and never having to know the viewport's size means a resize cannot
 * leave a bright strip down the edge of the screen.
 */
function maskPath(hole: Rect | null): string {
  const outer = 'M-9999 -9999H19999V19999H-9999Z';
  if (!hole) return outer;
  const x = hole.left - HALO;
  const y = hole.top - HALO;
  const w = hole.width + HALO * 2;
  const h = hole.height + HALO * 2;
  const r = Math.max(0, Math.min(RADIUS, w / 2, h / 2));
  return (
    `${outer}M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}` +
    `V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}` +
    `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}` +
    `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
  );
}

/**
 * The dialog panel on top, if any is open.
 *
 * Anything the user opens from inside the lit area takes the light, whether
 * this tour asked for it or not. Clicking "make a group" and being left with
 * the new dialog in the dark, behind a card still describing the panel it came
 * from, is the one thing a live spotlight must not do. Panels are named
 * "<name>-dialog", and the last one in the document is the one on top.
 */
function openDialog(): Element | null {
  const panels = document.querySelectorAll('[data-tour$="-dialog"]');
  return panels.length ? panels[panels.length - 1] : null;
}

/** True while the caret is somewhere that owns the keyboard. */
function typing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable;
}

/**
 * A still of the standing-task editor, as it appears behind your picture.
 *
 * Drawn here rather than by opening the real thing. That screen is a sign-in
 * form until there is an account to show, which is exactly the state everybody
 * taking this tour is in, so opening it would illustrate the wrong half of the
 * app. This shows what the routine list becomes once there is one, and writes
 * nothing to anybody's account to do it.
 */
function StandingPreset() {
  const rows = [
    { label: 'strength training', icon: 'dumbbell', days: ['mon', 'wed', 'fri'] },
    { label: 'read 10 pages', icon: 'book', days: [...DAY_IDS] as string[] },
  ];

  return (
    <div
      aria-hidden="true"
      className="mt-4 rounded-xl p-4"
      style={{
        backgroundColor: 'rgb(var(--frost-far-rgb) / 0.03)',
        border: '1px solid var(--frost-hairline)',
      }}
    >
      <p className="text-sm text-frost-text">Standing tasks</p>
      <p className="mt-1 text-xs text-frost-text-faint">Added to each new week.</p>

      <div className="mt-3.5 flex flex-col gap-4">
        {rows.map((row) => (
          <div key={row.label} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <span
                className="min-w-0 flex-1 truncate pb-1 text-sm text-frost-text"
                style={{ borderBottom: '1px solid var(--frost-hairline)' }}
              >
                {row.label}
              </span>
              <span className="shrink-0 text-frost-cyan-300">
                <TaskIcon icon={row.icon} size={14} strokeWidth={2} />
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DAY_IDS.map((id) => {
                const on = row.days.includes(id);
                return (
                  <span
                    key={id}
                    className={`rounded py-1 text-center font-mono text-xs lowercase ${
                      on ? 'bg-frost-cyan-900 text-frost-cyan-200' : 'text-frost-text-faint'
                    }`}
                  >
                    {DAY_SHORT[id].slice(0, 2)}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type Props = {
  /** Called on exit and on finish alike. Both mean the tour is over. */
  onClose: () => void;
  /** Opens the dialog a step wants lit, or closes it again with `null`. */
  onStage: (stage: TourStage | null) => void;
};

/**
 * A guided first run.
 *
 * The app deliberately explains nothing on its surface, which is what keeps it
 * quiet, and the price of that is a first screen which does not say what any
 * of it is. This pays that price once: one part of the real page is lit at a
 * time and told what it does, on the user's own week rather than in a picture
 * of somebody else's.
 *
 * The lit part stays live. Everything outside it is caught by the dim, so
 * nothing can be changed by accident, but the one thing being talked about can
 * be clicked, typed into and tried while the words explaining it are still on
 * screen. That is the whole reason to run a tour over the real app rather than
 * over screenshots of it.
 *
 * It is shown once. `App` decides that from the account and the device
 * together, and every way out of here reports the same thing, so leaving at
 * step one counts exactly as much as reading to the end.
 */
export function Tour({ onClose, onStage }: Props) {
  /* Resolved once, after the first commit rather than during it.
     A step whose element is not in the document is dropped rather than left
     pointing at nothing: the layout moves things between breakpoints, and a
     card lighting an empty corner is worse than a card that was never there.
     A staged step is exempt, because the screen it points at is one this tour
     has not opened yet.
     Reading it during render finds nothing at all: the tour mounts in the same
     commit as the page it describes, so the elements are in React's tree by
     then and in the document only afterwards. */
  const [steps, setSteps] = useState<Step[]>([]);
  useEffect(() => {
    setSteps(
      STEPS.filter(
        (s) => !s.target || s.stage || document.querySelector(`[data-tour="${s.target}"]`),
      ),
    );
  }, []);

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  /* The animated box, kept out of state so a frame that changes nothing costs
     nothing. `rect` is only ever this, mirrored for rendering. */
  const shownRef = useRef<Rect | null>(null);
  /* The element that box currently belongs to. A different element is a cut,
     not a move: the light arrives on it whole. Only the same element shifting
     under the light is worth easing, which is what a smooth scroll does. */
  const litRef = useRef<Element | null>(null);

  const step = steps[index];
  const last = index === steps.length - 1;

  /* Read from `index` rather than from a `setIndex` updater. React runs an
     updater during the render phase, so closing the tour from inside one was
     setting state on `App` mid-render, which React warns about and which is a
     real hazard: an updater is allowed to run more than once. */
  const next = useCallback(() => {
    if (index + 1 >= steps.length) {
      onClose();
      return;
    }
    setIndex(index + 1);
  }, [index, steps.length, onClose]);

  const back = useCallback(() => setIndex((i) => Math.max(0, i - 1)), []);

  /* Whatever screen this step wants, open; and on the way out, closed again.
     Held in `App` because the dialogs are its state, and a dialog the tour
     opened must not outlive the tour that opened it. */
  useEffect(() => {
    onStage(step?.stage ?? null);
  }, [step, onStage]);

  useEffect(() => () => onStage(null), [onStage]);

  /* One loop per step, re-querying the target every frame.
     Re-querying rather than holding the node is what makes a staged step work
     at all: the dialog it points at is opened by an effect that runs after
     this one, so the element does not exist yet on the first frame. It is also
     the honest answer when the user closes that dialog themselves, where the
     light goes out rather than clinging to a detached node. */
  useLayoutEffect(() => {
    if (!step?.target) {
      shownRef.current = null;
      litRef.current = null;
      setRect(null);
      return;
    }

    const selector = `[data-tour="${step.target}"]`;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let scrolled = false;
    let raf = 0;

    const tick = () => {
      // The step's own target, unless something is open in front of it.
      const own = document.querySelector(selector);
      const el = openDialog() ?? own;
      if (!el) {
        if (shownRef.current !== null) {
          shownRef.current = null;
          litRef.current = null;
          setRect(null);
        }
      } else {
        // Only ever scrolls to the step's own target. A dialog centres itself.
        if (!scrolled && el === own) {
          scrolled = true;
          el.scrollIntoView({ block: 'center', behavior: still ? 'auto' : 'smooth' });
        }
        const want = measure(el);
        const shown = shownRef.current;
        // Eased only where the same element has shifted under the light.
        const following = litRef.current === el && shown && !still;
        litRef.current = el;
        const moved = following ? glide(shown, want) : want;
        if (!shown || !settled(shown, moved)) {
          shownRef.current = moved;
          setRect(moved);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    tick();
    return () => cancelAnimationFrame(raf);
  }, [step]);

  /* Every render, not every frame: whatever should be lit, is lit, now.
     This is what puts the light on a dialog the moment one opens, including
     one the user opened themselves from inside the lit area, and what gets a
     staged step onto its dialog, which does not exist until the render after
     the step. Frames are for movement, and a page nobody is looking at does
     not run any. */
  useLayoutEffect(() => {
    if (!step?.target) return;
    const el = openDialog() ?? document.querySelector(`[data-tour="${step.target}"]`);
    if (!el || litRef.current === el) return;
    litRef.current = el;
    const want = measure(el);
    shownRef.current = want;
    setRect(want);
  });

  /* Focus moves to the card on every step, which is what makes a screen reader
     announce the new one: the card is the only thing that changed, and it is
     not the thing that was clicked. `step` is a dependency as well as the
     index, because the card does not exist on the first render, the step list
     being resolved only after the commit. */
  useEffect(() => {
    cardRef.current?.focus();
  }, [index, step]);

  /* No focus trap, deliberately, and no blanket Escape.
     The lit area is meant to be used, so Tab has to be able to reach it and a
     field inside it has to keep its own keys: Escape cancels the task row you
     are typing, and the arrows move the caret. The tour takes a key only when
     nothing is being typed into. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* A dialog in front of the light owns the keyboard entirely. Escape
         belongs to it, or one press would close the dialog and the tour
         behind it together; and stepping the tour on with an arrow while
         somebody is picking an icon is not what the arrow meant. */
      if (typing() || openDialog()) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') back();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [next, back, onClose]);

  if (!step) return null;

  /* Docked rather than tethered to the box it describes: a tether has to be
     measured against the card's own height and rescued from four edges, and it
     still lands somewhere different every step. */
  const zoom = pageZoom();
  const viewportH = window.innerHeight / zoom;
  const { dock, width } = placeFor(
    rect,
    window.innerWidth / zoom,
    viewportH,
    step.hero ? HERO : CARD,
  );
  const maxHeight = maxCardHeight(dock, rect, viewportH);

  return createPortal(
    /* The container passes clicks straight through. What catches them is the
       dim itself, so the hole in it is a hole in every sense. */
    <div className="pointer-events-none fixed inset-0 z-[80]">
      <svg className="fixed inset-0 h-full w-full" aria-hidden="true">
        <path
          d={maskPath(rect)}
          fillRule="evenodd"
          style={{ fill: 'rgb(var(--frost-base-rgb) / 0.88)', pointerEvents: 'auto' }}
        />
      </svg>

      {/* The frame around the light. Separate from the mask because it must not
          take the clicks the mask is there to absorb. */}
      {rect && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed"
          style={{
            top: rect.top - HALO,
            left: rect.left - HALO,
            width: rect.width + HALO * 2,
            height: rect.height + HALO * 2,
            borderRadius: RADIUS,
            border: '1px solid rgb(var(--frost-accent-rgb) / 0.4)',
          }}
        />
      )}

      <div
        ref={cardRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Tour"
        className={`frost-rise pointer-events-auto fixed flex flex-col rounded-2xl focus:outline-none ${
          step.hero ? 'p-9 sm:p-10' : 'p-6'
        }`}
        style={{
          ...DOCK_STYLE[dock],
          width,
          maxHeight,
          backgroundColor: 'var(--color-frost-surface)',
          backgroundImage:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), rgb(var(--frost-accent-rgb) / 0) 62%)',
          border: '1px solid rgb(var(--frost-accent-rgb) / 0.16)',
          boxShadow: '0 20px 50px -20px rgb(var(--frost-base-rgb) / 0.95)',
        }}
      >
        {/* The words scroll; the buttons do not. A card squeezed into a narrow
            band still has its way out and its way on, at the same size and in
            the same corner as on every other step. */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="font-mono text-xs text-frost-text-faint">
            <span className="text-frost-cyan-300">{index + 1}</span> / {steps.length}
          </p>

          <h2
            className={`font-display leading-snug tracking-tight text-frost-text ${
              step.hero ? 'mt-3 text-2xl' : 'mt-2 text-lg'
            }`}
          >
            {step.title}
          </h2>
          <p
            className={`leading-relaxed text-frost-text-dim ${
              step.hero ? 'mt-4 text-base' : 'mt-2.5 text-sm'
            }`}
          >
            {step.body}
          </p>

          {step.preset === 'standing' && <StandingPreset />}
        </div>

        {/* Leaving is offered on every card, in the same place and at the same
            size, and never dressed up as a mistake. Somebody who does not want
            this should not have to read it to find the way out. */}
        <div className="mt-6 flex shrink-0 items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-frost-text-faint transition-colors duration-150 hover:text-frost-text-dim"
          >
            exit
          </button>

          <div className="flex items-center gap-2">
            {index > 0 && (
              <button
                type="button"
                onClick={back}
                className="rounded-lg px-3 py-2 text-sm text-frost-text-dim transition-colors duration-150 hover:text-frost-cyan-300"
              >
                back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              className="min-h-11 rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{
                backgroundColor: 'var(--color-frost-cyan-200)',
                color: 'var(--frost-on-accent)',
              }}
            >
              {last ? 'start' : 'next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
