/**
 * Whether the tour has already been given on this device.
 *
 * The account is the real record of it — `Prefs.tourDone` follows you to every
 * device you sign in on — but the account is not always there to ask. A new
 * account's prefs document does not exist yet, and prefs are cached under a
 * key scoped to the uid, so somebody who takes the tour signed out and then
 * creates an account would be handed straight back to step one. This flag
 * closes that window. Either record counts as having seen it.
 *
 * Deliberately not scoped to a uid: it is a fact about the browser, not about
 * a person, and the whole point is that it survives signing in.
 */
const KEY = 'frost-week-tracker:tour-seen';

export function tourSeenOnDevice(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    /* Private mode. The account copy still answers for anyone signed in, and
       a tour shown twice is a much smaller failure than one shown never. */
    return false;
  }
}

export function markTourSeenOnDevice(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* As above. */
  }
}
