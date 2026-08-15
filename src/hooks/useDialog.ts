import { useEffect, useRef } from 'react';

/**
 * The keyboard half of a modal dialog.
 *
 * All three dialogs already declared `aria-modal="true"` and closed on Escape,
 * but none of them moved focus. They render as ordinary siblings after the
 * whole app in DOM order, so opening one and pressing Tab walked the entire
 * page behind the overlay first — the clock, all seven day buttons, every task
 * row — before ever reaching the dialog's own controls. A mouse user is
 * contained by the backdrop; a keyboard user was not contained at all.
 *
 * Returns the ref to spread onto the dialog's panel.
 */
export function useDialog(open: boolean, onClose: () => void) {
  const panelRef = useRef<HTMLDivElement>(null);

  /* `onClose` is held in a ref and deliberately NOT a dependency below.
     Callers pass an inline arrow, so its identity changes on every render of
     the parent — and this effect moves focus on setup and restores it on
     cleanup. Naming it as a dependency meant any state change while the dialog
     was open tore the effect down, threw focus out of whatever field you were
     in, and re-entered on the panel. Typing your theme's name did exactly
     that: the name is app state, so every keystroke re-rendered App and
     bounced the caret out of the box. One letter per click.

     The effect must run once per open and clean up once per close. That is
     what `[open]` alone expresses. */
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;

    // Remembered before focus moves, so closing puts the caret back on the
    // control that opened the dialog rather than at the top of the document.
    const opener = document.activeElement as HTMLElement | null;

    const focusable = () =>
      Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement);

    // Focus the panel itself rather than its first control: landing on a text
    // field would pop a phone keyboard open before the user asked for one, and
    // landing on a button makes it ambiguous whether Enter would fire it.
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      // Wrap at both ends, and pull focus back in if it has escaped to the
      // page behind — which is where it starts, since the panel is last in
      // the document.
      if (!panelRef.current?.contains(active)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Only if focus is still inside the dialog being torn down — otherwise
      // this would yank it away from wherever the user has since moved.
      if (!panelRef.current || panelRef.current.contains(document.activeElement)) {
        opener?.focus?.();
      }
    };
  }, [open]);

  return panelRef;
}
