/**
 * Eight teeth, struck outward from the rim at 45° intervals.
 *
 * Generated rather than written out as literal path data: sixteen hand-typed
 * coordinates that must stay on a circle is a thing that goes subtly wrong the
 * first time anyone adjusts the size. The teeth are stroked heavier than the
 * two circles so the mark reads as a gear rather than as a sun.
 */
const TEETH = Array.from({ length: 8 }, (_, i) => {
  const angle = (i * Math.PI) / 4;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x1: 8 + 5.2 * cos,
    y1: 8 + 5.2 * sin,
    x2: 8 + 6.8 * cos,
    y2: 8 + 6.8 * sin,
  };
});

function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true">
      {TEETH.map((t) => (
        <line
          key={t.x1 + ':' + t.y1}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
        />
      ))}
      <circle cx="8" cy="8" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="8" r="2.2" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

type Props = {
  onClick: () => void;
  /**
   * Where this instance lives.
   *
   * Two placements rather than one moved by CSS, because the two are different
   * objects: in the header it is a quiet verb in a row of quiet verbs, and it
   * takes its colour from the accent ramp like the week arrows beside it. On a
   * phone the header stacks and centres, which is no place for a control you
   * reach for occasionally — so it becomes a corner button opposite the info
   * one, and picks up that button's filled treatment instead.
   *
   * Each hides itself at the breakpoint the other takes over, so exactly one
   * is ever on screen.
   */
  variant: 'header' | 'floating';
};

/** Opens the theme dialog. The wordmark used to do this; it is a name now. */
export function SettingsButton({ onClick, variant }: Props) {
  const floating = variant === 'floating';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-label="Settings"
      title="Settings"
      className={
        floating
          ? 'fixed right-5 bottom-5 z-40 grid h-8 w-8 place-items-center rounded-full transition-colors duration-150 sm:hidden'
          : /* `-m-1.5` gives it a 40px target inside a 28px visual footprint,
               exactly as the week arrows do, so the optical gaps in the header
               cluster stay even. */
            '-m-1.5 hidden h-10 w-10 place-items-center rounded text-frost-cyan-500 transition-colors duration-150 hover:text-frost-cyan-200 sm:grid'
      }
      style={
        floating
          ? {
              backgroundColor: 'rgb(var(--frost-accent-rgb) / 0.12)',
              color: 'var(--color-frost-cyan-300)',
            }
          : undefined
      }
    >
      <GearIcon />
    </button>
  );
}
