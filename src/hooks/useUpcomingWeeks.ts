import { useEffect, useMemo, useState } from 'react';
import type { Week } from '../types';
import type { WeekStore } from '../lib/storage';

/**
 * Far enough ahead to cover a term's worth of deadlines, near enough that this
 * never becomes a bulk read of somebody's whole history.
 */
const MAX_WEEKS_AHEAD = 10;

/**
 * The weeks after the one on screen, for the groups that report across them.
 *
 * Read-only and entirely separate from `useWeek`, which owns the open week and
 * every mutation to it. Nothing here is ever written back, so there is no
 * debounce, no dirty flag and no way for a slow fetch to land on top of an
 * edit — the worst a failed read can do is show one group as having nothing
 * coming.
 *
 * `enabled` is false until at least one group actually asks for this, so an
 * account that never turns the option on does no extra reads at all.
 */
export function useUpcomingWeeks(
  store: WeekStore,
  ready: boolean,
  knownWeeks: string[],
  weekStart: string,
  enabled: boolean,
) {
  const [weeks, setWeeks] = useState<Week[]>([]);

  /* `knownWeeks` is rebuilt on every save, so depending on the array itself
     would re-fetch each time a checkbox is ticked. The joined string only
     changes when the set of weeks genuinely does. */
  const later = useMemo(
    () =>
      knownWeeks
        .filter((w) => w > weekStart)
        .sort()
        .slice(0, MAX_WEEKS_AHEAD),
    [knownWeeks, weekStart],
  );
  const laterKey = later.join(',');

  useEffect(() => {
    if (!ready || !enabled || laterKey === '') {
      setWeeks([]);
      return;
    }
    let active = true;
    Promise.all(laterKey.split(',').map((w) => store.loadWeek(w).catch(() => null)))
      .then((loaded) => {
        if (active) setWeeks(loaded.filter((w): w is Week => w !== null));
      })
      .catch(() => {
        if (active) setWeeks([]);
      });
    return () => {
      active = false;
    };
  }, [ready, enabled, laterKey, store]);

  return weeks;
}
