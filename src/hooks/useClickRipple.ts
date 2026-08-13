import { useEffect } from 'react';

/**
 * A cyan bloom wherever you click.
 *
 * Three things about this are deliberate:
 *
 *  1. CAPTURE PHASE. TaskRow, WeekStrip and AccountDialog all call
 *     `stopPropagation()` in the bubble phase so their own click logic works.
 *     A bubble-phase listener here would go dead on exactly the elements you
 *     click most — checkboxes, edit/delete, modal content. Capture runs before
 *     any of them, and this listener never calls preventDefault or
 *     stopPropagation itself, so it cannot break anything downstream.
 *
 *  2. THE REDUCED-MOTION CHECK IS IN JS, LIVE, PER CLICK. The CSS approach
 *     used for every other animation here sets `animation: none`, which for a
 *     node whose cleanup is gated on `animationend` means the event never
 *     fires and the element stays on screen forever. So: don't create it.
 *
 *  3. TRANSFORM AND OPACITY ONLY. The glow is a static box-shadow that gets
 *     scaled; animating shadow blur directly would repaint every frame, which
 *     is exactly the wrong thing on a low-end Chromebook.
 *
 * Against the glow budget this is a fifth site, added knowingly: it is
 * one-shot like the save confirm, it lives in its own layer outside the app
 * tree, and at rest there are zero of these nodes in the document.
 */

const MAX_CONCURRENT = 5;
/** Must stay >= the CSS animation duration. Backstop only. */
const LIFETIME_MS = 700;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export function useClickRipple(): void {
  useEffect(() => {
    const layer = document.createElement('div');
    layer.className = 'frost-ripple-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);

    const live = new Set<HTMLSpanElement>();

    const retire = (node: HTMLSpanElement) => {
      if (!live.delete(node)) return;
      node.remove();
    };

    const spawn = (x: number, y: number) => {
      // Oldest goes first, so a fast clicker never stacks up work.
      if (live.size >= MAX_CONCURRENT) {
        const oldest = live.values().next().value;
        if (oldest) retire(oldest);
      }

      const node = document.createElement('span');
      node.className = 'frost-ripple';
      node.style.left = `${x}px`;
      node.style.top = `${y}px`;

      live.add(node);
      layer.appendChild(node);

      node.addEventListener('animationend', () => retire(node), { once: true });
      // If the animation is suppressed after the node exists, animationend
      // never fires and this is the only thing that cleans it up.
      setTimeout(() => retire(node), LIFETIME_MS);
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (prefersReducedMotion()) return;
      spawn(e.clientX, e.clientY);
    };

    document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, { capture: true });
      live.clear();
      layer.remove();
    };
  }, []);
}
