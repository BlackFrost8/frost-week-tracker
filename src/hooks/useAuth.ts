import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isCloudConfigured } from '../lib/supabase';

export type AuthMode = 'loading' | 'signed-in' | 'signed-out' | 'offline';

/**
 * `offline` means Supabase was never configured for this build, so there is
 * nothing to sign in to — the app falls back to localStorage. That's a valid
 * end state, not an error.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [mode, setMode] = useState<AuthMode>(isCloudConfigured ? 'loading' : 'offline');

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setMode(data.session ? 'signed-in' : 'signed-out');
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setMode(next ? 'signed-in' : 'signed-out');
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    mode,
    user: session?.user ?? null,
    email: session?.user?.email ?? null,
  };
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<{ needsConfirm: boolean }> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  // With "Confirm email" enabled, Supabase returns a user but no session.
  return { needsConfirm: !data.session };
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export async function sendPasswordReset(email: string): Promise<void> {
  if (!supabase) throw new Error('Cloud sync is not configured.');
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}
