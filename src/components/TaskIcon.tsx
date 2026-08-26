import { iconById } from '../lib/icons';

type Props = {
  icon: string | null | undefined;
  /** Rendered size in px. The 24-unit grid is scaled to it. */
  size?: number;
  /**
   * Stroke on the 24-unit grid, so it must go UP as the glyph gets smaller: a
   * 1.6 stroke drawn at 14px lands at 0.93 device pixels, which on a dark
   * canvas is a grey suggestion of a line rather than a line. The defaults per
   * call site are 2.0 at 14px, 1.8 at 16–18px, 1.6 at 22px and above.
   */
  strokeWidth?: number;
  /** Given only when the glyph carries meaning nothing beside it repeats. */
  title?: string;
  className?: string;
};

/**
 * One glyph from `lib/icons`, in `currentColor`.
 *
 * Colour is deliberately not a prop. Groups get their identity from the shape
 * alone, never from a hue of their own — the palette here is derived from the
 * user's two theme colours at runtime, so a per-group colour would be the only
 * thing on the page that a theme change couldn't reach. It also protects the
 * chroma budget (§6): one accent, spent on the things that report progress.
 */
export function TaskIcon({ icon, size = 16, strokeWidth = 1.8, title, className }: Props) {
  const def = iconById(icon);
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      {def.d.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
