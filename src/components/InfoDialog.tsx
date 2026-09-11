import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../hooks/useDialog';

/**
 * What the app can do, in one place. The one screen allowed to explain, which
 * is what keeps every other screen free to say nothing.
 *
 * KEEP THIS LIST CURRENT. A feature that ships without a line here is a
 * feature most people will never find.
 */
const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: 'Your week',
    items: [
      'Pick a day from the strip along the top.',
      'Move between weeks with the arrows, or open the date to jump to any week.',
      'A "today" button appears when you are looking at a different week.',
    ],
  },
  {
    title: 'Tasks',
    items: [
      'Add a task with "+ add task". Enter saves it, Escape cancels it.',
      'An empty day shows what you did on that weekday last week, in grey. Click one to add it.',
      'Click a row to tick it off. Hover a row for its controls.',
      'The arrow on a hovered row moves that task to another day. It keeps its group and its tick.',
      'Deleting a task\u2019s text deletes the row.',
    ],
  },
  {
    title: 'Groups',
    items: [
      'Make a group in the groups panel. It needs a name and an icon.',
      'Put a task in a group with the tag button on its row, or while you are typing it.',
      'The group\u2019s icon shows next to the task, and its bar shows how much of that group is done.',
      'Open a group to see everything in it. Click a task there to jump to its day.',
    ],
  },
  {
    title: 'Standing tasks',
    items: [
      'Open your profile picture, or "sign in", and list the tasks you do regularly.',
      'They are added to every new week automatically.',
      'Choose which days each one appears on, and give it a group to carry.',
      '"add these to this week" adds them to the week you are already in.',
    ],
  },
  {
    title: 'Goals',
    items: [
      'Write what you are working toward, under the groups panel.',
      'Goals do not reset on Monday. They stay until you tick them off.',
    ],
  },
  {
    title: 'This week',
    items: [
      'Set a focus, a reward and an affirmation in the side panel.',
      'The ring shows how much of the week is done. The curve shows your pace.',
      '"clear checks" unticks everything and keeps the text.',
    ],
  },
  {
    title: 'Timer',
    items: [
      'The clock in the header is also a stopwatch and a countdown.',
      'Switch between counting up and down, and add or remove minutes before you start.',
      'Expand it to fill the screen.',
    ],
  },
  {
    title: 'Making it yours',
    items: [
      'Open settings with the gear beside the clock, or the one in the bottom right on a phone.',
      'Pick one of the five themes, or set your own two colours.',
      'Rename the app, and the name replaces the wordmark in the corner.',
    ],
  },
  {
    title: 'Your account',
    items: [
      'Sign in with Google, or an email and password if popups are blocked.',
      'Everything saves automatically.',
      'Anything you made before signing in is brought into your account.',
      'Set a profile picture from your device, or use your Google one.',
    ],
  },
];

function InfoIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      <circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      <path
        d="M8 7.2v4.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

type Props = {
  /** Reopens the guided tour. The dialog closes first: two overlays at once
      would leave the tour lighting things behind a panel covering them. */
  onReplayTour: () => void;
};

export function InfoDialog({ onReplayTour }: Props) {
  const [open, setOpen] = useState(false);

  // Stable identity: the hook restores focus in its cleanup, so a new closure
  // each render would tear down and re-run that on every parent render.
  const close = useCallback(() => setOpen(false), []);
  const panelRef = useDialog(open, close);

  return (
    <>
      {/* Fixed bottom-left, out of the way of everything. Colour comes from the
          accent tokens rather than fixed values, so it re-reads correctly on
          any theme — including a light one, where `on-accent` flips. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="What you can do"
        title="What you can do"
        className="fixed bottom-5 left-5 z-40 grid h-8 w-8 place-items-center rounded-full transition-colors duration-150"
        style={{
          backgroundColor: 'rgb(var(--frost-accent-rgb) / 0.12)',
          color: 'var(--color-frost-cyan-300)',
        }}
      >
        <InfoIcon />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto p-5"
            style={{
              backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)',
              backdropFilter: 'blur(6px)',
            }}
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="What you can do"
          >
            <div
              ref={panelRef}
              tabIndex={-1}
              // Named for the tour, which lights whichever dialog is open.
              data-tour="info-dialog"
              className="frost-rise my-auto w-full max-w-lg rounded-2xl p-7 focus:outline-none"
              style={{
                background:
                  'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), var(--color-frost-surface) 62%)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="font-display text-lg tracking-tight text-frost-text">
                What you can do
              </h2>

              <div className="mt-7 flex flex-col gap-7">
                {SECTIONS.map((section) => (
                  <section key={section.title}>
                    <h3 className="text-sm text-frost-cyan-300">{section.title}</h3>
                    <ul className="mt-2.5 flex flex-col gap-2">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-3 text-sm leading-relaxed">
                          <span
                            className="mt-[9px] h-[3px] w-[3px] shrink-0 rounded-full"
                            style={{ backgroundColor: 'var(--color-frost-cyan-500)' }}
                            aria-hidden="true"
                          />
                          <span className="text-frost-text-dim">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>

              {/* The way back to the tour, and the only one. Exiting at step
                  one is a reasonable thing to do and must not be the last
                  word on it. */}
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onReplayTour();
                }}
                className="mt-8 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150 hover:text-frost-cyan-200"
                style={{
                  border: '1px solid rgb(var(--frost-accent-rgb) / 0.22)',
                  color: 'var(--color-frost-cyan-300)',
                }}
              >
                take the tour
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-2.5 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
                style={{
                  backgroundColor: 'var(--color-frost-cyan-200)',
                  color: 'var(--frost-on-accent)',
                }}
              >
                got it
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
