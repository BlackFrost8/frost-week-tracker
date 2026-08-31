type Props = {
  onLift: () => void;
};

/** Shared with the account dialog's button, so the two read as one feature. */
export function LockGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} aria-hidden="true">
      <rect
        x="3.2"
        y="7"
        width="9.6"
        height="6.4"
        rx="1.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * What sits over the app while it is hidden.
 *
 * `backdrop-filter` rather than a `filter` on the app itself, which matters
 * more than it sounds: a filtered element becomes the containing block for
 * every `position: fixed` descendant inside it, so blurring the app that way
 * would re-anchor the ambient layer and the info button to the document rather
 * than the viewport, and they would visibly jump on each toggle. Blurring what
 * is *behind* this layer leaves the page underneath untouched.
 *
 * It also blocks the pointer, which is half of "no actions can be taken" — the
 * other half is the `inert` app wrapper, since a caret left blinking in a task
 * row would otherwise still accept typing through the blur.
 */
export function PrivacyCurtain({ onLift }: Props) {
  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center"
      style={{
        backdropFilter: 'blur(26px) saturate(0.55)',
        WebkitBackdropFilter: 'blur(26px) saturate(0.55)',
        backgroundColor: 'rgb(var(--frost-base-rgb) / 0.4)',
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Screen hidden"
    >
      {/* The one control that still works, and the shortcut that made it
          happen — a curtain with no visible way out is a trap on any device
          where the hotkey doesn't reach the page. */}
      <button
        type="button"
        autoFocus
        onClick={onLift}
        className="flex items-center gap-3 rounded-full px-5 py-3 transition-colors duration-150"
        style={{
          border: '1px solid rgb(var(--frost-accent-rgb) / 0.22)',
          backgroundColor: 'rgb(var(--frost-accent-rgb) / 0.04)',
        }}
      >
        <span className="text-frost-cyan-300">
          <LockGlyph />
        </span>
        <span className="font-mono text-sm text-frost-text-dim">alt + b</span>
      </button>
    </div>
  );
}
