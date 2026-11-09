import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs } from 'firebase/firestore/lite';
import { auth, db } from './firebase';

/**
 * Account deletion, in the app.
 *
 * It was an email to the developer, which Google Play does not accept: an app
 * that lets you make an account has to let you delete it from inside the app,
 * and the deletion has to take the data with it.
 */

/**
 * Proves it is still the account's owner at the keyboard. Firebase refuses to
 * delete an account whose sign-in is more than a few minutes old, and it is
 * better to ask first than to delete every week and then fail on the account.
 *
 * Google accounts confirm through Google's popup, which — like every popup —
 * must open in the same call stack as the click. This function's first
 * statement is that call, so it must be reached from a click with nothing
 * awaited before it. Password-only accounts confirm with the password.
 */
export async function confirmOwner(password: string | null): Promise<void> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in first.');

  if (user.providerData.some((p) => p.providerId === 'google.com')) {
    const provider = new GoogleAuthProvider();
    if (user.email) provider.setCustomParameters({ login_hint: user.email });
    await reauthenticateWithPopup(user, provider);
    return;
  }

  if (!user.email || !password) throw new Error('Enter your password to confirm.');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}

/**
 * Deletes everything the account holds — every week, the settings, the
 * imported calendar — and then the account itself.
 *
 * Data first, account last: Firestore's rules let only the signed-in owner
 * delete these documents, so once the account is gone nothing could remove
 * them any more. Call `confirmOwner` immediately before this.
 */
export async function deleteAccountAndData(): Promise<void> {
  const user = auth?.currentUser;
  if (!user || !db) throw new Error('Sign in first.');
  const uid = user.uid;

  const weeks = await getDocs(collection(db, 'users', uid, 'weeks'));
  await Promise.all(weeks.docs.map((d) => deleteDoc(doc(db!, 'users', uid, 'weeks', d.id))));
  await deleteDoc(doc(db, 'users', uid, 'settings', 'prefs'));
  await deleteDoc(doc(db, 'users', uid, 'settings', 'calendar'));

  await deleteUser(user);
}

/** Saves `data` as a JSON file through the browser's normal download. */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
