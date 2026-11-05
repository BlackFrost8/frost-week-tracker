import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_PREFS, loadPrefs, savePrefs, type Prefs, type PrefsField } from '../lib/prefs';

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * `ready` matters: a week must not be created before the standing tasks are
 * known, or the first week of a fresh sign-in gets built empty and the user's
 * list silently misses it.
 */
export function usePrefs(authReady: boolean, uid: string | null) {
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [ready, setReady] = useState(false);

  /* `update` takes a patch, so it needs the current value without being
     re-created on every change — a new identity each time would re-run the
     debounce effect that owns the standing-task editor. */
  const prefsRef = useRef(prefs);
  const apply = useCallback((next: Prefs) => {
    prefsRef.current = next;
    setPrefs(next);
  }, []);

  useEffect(() => {
    if (!authReady) return;
    let active = true;
    setReady(false);

    loadPrefs()
      // Whatever is stored, unmodified. Nothing is seeded on a new account:
      // an empty standing-task list is a real, chosen state.
      .then((loaded) => {
        if (active) apply(loaded);
      })
      .catch(() => {
        if (active) apply(EMPTY_PREFS);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [authReady, uid, apply]);

  /* Coming back to the tab re-reads, the same way weeks do. Prefs used to be
     read once at sign-in, so a tab left open for days went on showing — and
     writing — the groups and goals it had started with, while another device
     changed them. The load also retries any field whose write never landed.

     Applied only when something actually differs: a fresh array identity for
     the same standing tasks would re-run every effect keyed on them. */
  useEffect(() => {
    if (!authReady || !ready) return;
    let active = true;
    let inFlight = false;

    const onShow = () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      loadPrefs()
        .then((loaded) => {
          if (active && !sameValue(loaded, prefsRef.current)) apply(loaded);
        })
        .catch(() => {
          /* Keep what is on screen; the next return tries again. */
        })
        .finally(() => {
          inFlight = false;
        });
    };

    document.addEventListener('visibilitychange', onShow);
    window.addEventListener('focus', onShow);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onShow);
      window.removeEventListener('focus', onShow);
    };
  }, [authReady, ready, uid, apply]);

  const update = useCallback(
    async (patch: Partial<Prefs>) => {
      const next = { ...prefsRef.current, ...patch };
      apply(next); // Optimistic: the local write inside savePrefs cannot fail.
      // Only the fields this patch names are sent, so an edit to goals cannot
      // carry a stale copy of groups along with it.
      const fields = Object.keys(patch) as PrefsField[];
      // Callers fire this and walk away, so a dropped connection has to be
      // absorbed here or it surfaces as an unhandled rejection. The device
      // copy is written either way, and it is what the UI reads.
      await savePrefs(next, fields).catch(() => {});
    },
    [apply],
  );

  return { prefs, prefsReady: ready, updatePrefs: update };
}
