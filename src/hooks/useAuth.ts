import { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
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
};

function toProfile(user: User): Profile {
  return {
    uid: user.uid,
    name: user.displayName,
    email: user.email,
    avatarUrl: user.photoURL,
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

  return { profile, mode, email: profile?.email ?? null };
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
