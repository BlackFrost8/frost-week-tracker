import { useEffect, useState } from 'react';
import { todayISO } from '../lib/week';

/**
 * Today's date, kept true across midnight.
 *
 * `todayISO()` called during render is only ever right for as long as the
 * render lasts, and nothing in the tree re-renders on a date boundary. The
 * rollover that does exist runs on focus and visibility changes, which is
 * fine for a tab you come back to and useless for one you never leave: work
 * past midnight with the window focused and the app went on believing it was
 * yesterday, writing every edit into last week's document and pointing
 * "today" at the wrong card.
 *
 * The timer is set to the next local midnight and recomputed from the clock
 * each time it fires, never as a fixed 24-hour interval. That is also what
 * keeps it correct across a DST change, where a day is 23 or 25 hours long.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayISO);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const now = new Date();
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      // A second past the boundary, so a timer that fires a hair early — they
      // are allowed to — still reads the new date rather than re-arming for
      // a few milliseconds and burning a wakeup.
      const delay = midnight.getTime() - now.getTime() + 1000;

      timer = setTimeout(() => {
        setToday(todayISO());
        schedule();
      }, delay);
    };

    // A laptop asleep past midnight fires the timer late, on wake, which is
    // exactly when it should. But a suspended timer can also be dropped, so
    // resuming re-checks rather than trusting it.
    const recheck = () => setToday((current) => (todayISO() === current ? current : todayISO()));

    schedule();
    document.addEventListener('visibilitychange', recheck);
    window.addEventListener('focus', recheck);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', recheck);
      window.removeEventListener('focus', recheck);
    };
  }, []);

  return today;
}
