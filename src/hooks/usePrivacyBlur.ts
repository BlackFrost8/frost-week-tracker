import { useCallback, useEffect, useState } from 'react';

/**
 * Alt+B hides the screen without closing anything.
 *
 * The week, the goals and the group names are the whole of what this app
 * holds, and all three are readable from across a room — which is the actual
 * threat when it is running as a desktop wallpaper. This is a curtain, not a
 * lock: it is for the person walking past, and it makes no claim beyond that.
 *
 * Not persisted. A blur that survived a reload would be a state you could get
 * stuck in on a device whose keyboard has no working Alt, and the curtain is
 * meant to be lifted the moment you sit back down.
 */
export function usePrivacyBlur() {
  const [blurred, setBlurred] = useState(false);

  const toggle = useCallback(() => setBlurred((v) => !v), []);
  const hide = useCallback(() => setBlurred(true), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* Either identifier will do, because neither is reliable on its own.
         `code` is the physical key and survives layouts where Alt+B reports a
         punctuation character or a dead key — but it arrives empty from some
         embedders that synthesise input rather than forwarding a scancode,
         and an embedded browser is exactly where this app runs as a wallpaper.
         `key` covers that case. Ctrl is excluded so AltGr combinations, which
         Windows reports as Ctrl+Alt, still type their character. */
      const isB = e.code === 'KeyB' || e.key === 'b' || e.key === 'B';
      if (!isB || !e.altKey || e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      setBlurred((v) => !v);
    };

    /* Capture phase, so a focused task input cannot swallow the shortcut
       first — the moment you most want to hide the screen is the moment you
       are mid-sentence in one. */
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  return { blurred, toggle, hide };
}
