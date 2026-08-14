import { useCallback, useEffect, useState } from 'react';
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
          const seeded = { defaultTasks: STARTER_DEFAULTS };
          setPrefs(seeded);
          void savePrefs(seeded).catch(() => {});
        } else {
          setPrefs(loaded);
        }
      })
      .catch(() => {
        if (active) setPrefs(EMPTY_PREFS);
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [authReady, uid]);

  const update = useCallback(async (defaultTasks: string[]) => {
    const next = { defaultTasks };
    setPrefs(next); // Optimistic: the local write inside savePrefs cannot fail.
    await savePrefs(next);
  }, []);

  return { prefs, prefsReady: ready, updateDefaultTasks: update };
}
