import { useCallback, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth, isCloudConfigured } from '../lib/firebase';

export type AuthMode = 'loading' | 'signed-in' | 'signed-out' | 'offline';

export type Profile = {
  uid: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  /** Whether this account can be signed into with a password at all. Read from
      `providerData`, which is local to the token — no network, and unaffected
      by the email-enumeration protection that makes every failed sign-in
      report the same generic code. */
  hasPassword: boolean;
};

function toProfile(user: User): Profile {
  return {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    avatarUrl: user.photoURL,
    hasPassword: user.providerData.some((p) => p.providerId === 'password'),
  };
}

/**
 * `offline` means Firebase was never configured for this build, so there is
 * nothing to sign in to — the app falls back to localStorage. That's a valid
 * end state, not an error.
 */
export function useAuth() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [mode, setMode] = useState<AuthMode>(isCloudConfigured ? 'loading' : 'offline');

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (user) => {
      setProfile(user ? toProfile(user) : null);
      setMode(user ? 'signed-in' : 'signed-out');
    });
  }, []);

  /* Linking a credential mutates `currentUser` in place without firing
     `onAuthStateChanged` — that only tracks sign-in and sign-out. Without this,
     `hasPassword` would stay false until the next full sign-in and the dialog
     would keep offering to add a password that already exists. */
  const refresh = useCallback(() => {
    if (auth?.currentUser) setProfile(toProfile(auth.currentUser));
  }, []);

  return { profile, mode, refresh, email: profile?.email ?? null };
}

/**
 * Popup rather than redirect: the OAuth handshake happens inside the popup on
 * Firebase's own domain, so a static host never has to serve a callback path —
 * which is what would otherwise 404 on GitHub Pages. It also sidesteps the
 * cross-origin storage access that redirect flows need and that third-party
 * cookie blocking increasingly breaks.
 *
 * Must be called synchronously from a click handler, never after an `await`,
 * or the browser will treat the popup as unsolicited and block it.
 */
export async function signInWithGoogle(): Promise<void> {
  if (!auth) throw new Error('Cloud sync is not configured.');
  const provider = new GoogleAuthProvider();
  // Always let the user pick which Google account, rather than silently
  // reusing whichever one the browser saw last.
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(auth, provider);
}

export async function signOut(): Promise<void> {
  if (!auth) return;
  await fbSignOut(auth);
}

/* ── Email fallback ────────────────────────────────────────────────────────
   Kept deliberately, not as a legacy leftover. A managed school Chromebook
   can block third-party OAuth consent or popups outright, and if that happens
   Google sign-in is unrecoverable on the one device where it matters most.
   Enable Email/Password alongside Google in the Firebase console. */

export async function signIn(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Cloud sync is not configured.');
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signUp(email: string, password: string): Promise<void> {
  if (!auth) throw new Error('Cloud sync is not configured.');
  await createUserWithEmailAndPassword(auth, email, password);
}

/** Firebase hosts the reset page itself, so this genuinely resets a password —
    the old Supabase flow sent a magic link that never changed anything. */
export async function sendPasswordReset(email: string): Promise<void> {
  if (!auth) throw new Error('Cloud sync is not configured.');
  await sendPasswordResetEmail(auth, email);
}

/**
 * Attach a password to the account that is already signed in.
 *
 * This exists because of a Firebase rule that is easy to hit and impossible to
 * diagnose from the sign-in screen: when someone signs in with a provider that
 * verifies email ownership (Google), and a password account already exists on
 * the same address whose email was never verified, Firebase **removes the
 * password credential** rather than linking the two. The reasoning is sound —
 * an unverified password account may have been opened by someone who does not
 * own the address, so the provably-real owner takes it over — but the visible
 * result is a password that silently stops working while Google keeps working.
 *
 * Linking here is the documented repair, and it is durable: the address is
 * verified by now, so the same takeover cannot happen a second time.
 */
export async function linkPassword(password: string): Promise<void> {
  if (!auth) throw new Error('Cloud sync is not configured.');
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in first, then add a password.');
  if (!user.email) throw new Error('This account has no email address to attach a password to.');
  await linkWithCredential(user, EmailAuthProvider.credential(user.email, password));
}
