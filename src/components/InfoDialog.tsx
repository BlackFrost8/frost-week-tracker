import { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDialog } from '../hooks/useDialog';

/**
 * What the app can do, in one place.
 *
 * Everything here is discoverable by poking around — the wordmark opens the
 * theme, the avatar opens the account — but "discoverable" and "discovered"
 * are different things, and a sparse interface hides its own depth. This is
 * the one screen allowed to explain, which is what keeps every other screen
 * free to say nothing.
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
      '"today" appears when you’ve wandered off the current week.',
    ],
  },
  {
    title: 'Tasks',
    items: [
      'Add a task with "+ add task". Enter saves it, Escape throws it away.',
      'An empty day offers what you did on it last week, in grey. Click one to bring it forward.',
      'Click a row to tick it off. Hover a row to edit or delete it.',
      'Clearing a task’s text deletes the row.',
    ],
  },
  {
    title: 'Groups',
    items: [
      'Make a group in the groups panel — a name and a mark from the icon library.',
      'File a task with the tag button on its row, or while you type it.',
      'The group’s mark shows next to the task, and its bar tracks the week.',
      'Open a group to see everything in it, and click a task to jump to its day.',
    ],
  },
  {
    title: 'Standing tasks',
    items: [
      'Open your picture (or "sign in") and set the tasks you do regularly.',
      'They’re added to every new week automatically.',
      'Switch off the days a task doesn’t apply to, and give it a group to carry.',
      '"add these to this week" drops them into the week you’re already in.',
    ],
  },
  {
    title: 'This week',
    items: [
      'Set a focus, a reward and an affirmation in the side panel.',
      'The ring shows how much of the week is done; the curve shows your pace.',
      '"clear checks" unticks everything and keeps the text.',
    ],
  },
  {
    title: 'Timer',
    items: [
      'The clock in the header doubles as a stopwatch and a countdown.',
      'Switch between counting up and down, and add or remove minutes before you start.',
      'Expand it to fill the screen.',
      'It stays on this device.',
    ],
  },
  {
    title: 'Making it yours',
    items: [
      'Click the name in the top left to change the theme.',
      'The whole app is built from two colours.',
      'Rename it — the name becomes the wordmark.',
      'Themes stay on this device.',
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

export function InfoDialog() {
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

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-8 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
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
