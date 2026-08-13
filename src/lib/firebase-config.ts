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
 * To fill them in (about five minutes, one website, no Google Cloud Console):
 *
 *   1. console.firebase.google.com -> Add project -> name it -> you can
 *      uncheck Google Analytics -> Create.
 *   2. Build -> Authentication -> Get started -> Sign-in method -> Google ->
 *      Enable -> pick a Project support email -> Save.
 *   3. Authentication -> Settings -> Authorized domains -> Add domain ->
 *      planner.froststudio.org        (localhost is already authorised)
 *   4. Build -> Firestore Database -> Create database -> nearest region ->
 *      Production mode -> Create.
 *   5. Firestore -> Rules -> paste the contents of `firestore.rules` from this
 *      repo -> Publish.
 *   6. Gear icon -> Project settings -> Your apps -> click the </> (Web) icon
 *      -> give it a nickname -> Register app -> copy the `firebaseConfig`
 *      object it shows you.
 *   7. Paste those six values below, then commit and push.
 *
 * Until this is filled in the app runs local-only (localStorage, one device),
 * which is a perfectly valid end state — it just won't follow you across
 * devices and there will be nothing to sign in to.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};
