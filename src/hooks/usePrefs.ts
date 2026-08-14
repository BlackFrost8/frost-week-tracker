import { useCallback, useEffect, useRef, useState } from 'react';
import { EMPTY_PREFS, STARTER_DEFAULTS, loadPrefs, savePrefs, type Prefs } from '../lib/prefs';

const SEEDED_KEY = 'frost-week-tracker:prefs-seeded';

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
      .then((loaded) => {
        if (!active) return;
        // A brand-new user has no list, and an empty week reads as broken. Seed
        // the old hardcoded starters once, then never again — so someone who
        // deliberately clears the list doesn't get them back on next load.
        if (loaded.defaultTasks.length === 0 && localStorage.getItem(SEEDED_KEY) !== 'yes') {
          localStorage.setItem(SEEDED_KEY, 'yes');
          const seeded = { ...loaded, defaultTasks: STARTER_DEFAULTS };
          apply(seeded);
          void savePrefs(seeded).catch(() => {});
        } else {
          apply(loaded);
        }
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

  const update = useCallback(
    async (patch: Partial<Prefs>) => {
      const next = { ...prefsRef.current, ...patch };
      apply(next); // Optimistic: the local write inside savePrefs cannot fail.
      // Callers fire this and walk away, so a dropped connection has to be
      // absorbed here or it surfaces as an unhandled rejection. The device
      // copy is written either way, and it is what the UI reads.
      await savePrefs(next).catch(() => {});
    },
    [apply],
  );

  return { prefs, prefsReady: ready, updatePrefs: update };
}
