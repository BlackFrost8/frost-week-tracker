/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  PASTE YOUR FIREBASE CONFIG HERE. This is the only setup step in the app.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * These six values are PUBLIC client identifiers, not secrets — the same
 * reasoning that made the old Supabase anon key safe to commit. Security comes
 * from the Firestore rules in `firestore.rules`, which scope every document to
 * its owner. Anyone can read these out of the deployed bundle regardless.
 *
 * ─── DONE. Project `frost-week`, set up 14 Aug 2026. ────────────────────────
 *
 * Recorded so it can be rebuilt or audited:
 *
 *   1. console.firebase.google.com -> project `frost-week` (Spark, no-cost).
 *   2. Authentication -> Sign-in method. BOTH providers are enabled, and both
 *      are load-bearing:
 *        - Google. Public-facing name "FROST", support email set.
 *        - Email/Password. NOT optional: a managed school Chromebook can block
 *          third-party OAuth consent or popups, and that is the one device
 *          where losing sign-in makes the app pointless. "Email link
 *          (passwordless)" is deliberately left OFF — the app uses passwords.
 *   3. Authentication -> Settings -> Authorized domains: planner.froststudio.org
 *      added alongside the default localhost.
 *   4. Firestore -> Standard edition, database `(default)`, location **nam5
 *      (United States)**, started in Production mode (locked by default).
 *      The location is permanent and cannot be changed.
 *   5. Firestore -> Rules: the contents of `firestore.rules` published.
 *      Re-publish from that file whenever it changes — the console copy does
 *      not update itself.
 *   6. Project settings -> Your apps -> Web app "FROST Week Tracker".
 *      Firebase Hosting deliberately NOT enabled; the app deploys to GitHub
 *      Pages, so a Hosting site would just sit unused.
 *
 * If these are ever blanked out the app falls back to local-only
 * (localStorage, one device), which is a valid end state — it just won't
 * follow you across devices and there will be nothing to sign in to.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyDeTz-46XlhsOSUVzG8mgCAdut4dUBActM',
  authDomain: 'frost-week.firebaseapp.com',
  projectId: 'frost-week',
  storageBucket: 'frost-week.firebasestorage.app',
  messagingSenderId: '56011893869',
  appId: '1:56011893869:web:9e21fba064dd94f027a364',
};
