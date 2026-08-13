import { useEffect, useState } from 'react';
import { sendPasswordReset, signIn, signUp } from '../hooks/useAuth';
import {
  activeProjectUrl,
  clearRuntimeConfig,
  isCloudConfigured,
  saveRuntimeConfig,
} from '../lib/supabase';

type Props = {
  open: boolean;
  onClose: () => void;
  email: string | null;
};

type Tab = 'sign-in' | 'sign-up';

export function AccountDialog({ open, onClose, email }: Props) {
  const [tab, setTab] = useState<Tab>('sign-in');
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Connect form (only shown when no Supabase project is configured)
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');

  useEffect(() => {
    if (open) {
      setError(null);
      setNotice(null);
      setPassword('');
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submitAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (tab === 'sign-in') {
        await signIn(emailInput.trim(), password);
        onClose();
      } else {
        const { needsConfirm } = await signUp(emailInput.trim(), password);
        if (needsConfirm) {
          setNotice('Account created. Check your email for the confirmation link, then sign in.');
        } else {
          onClose();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const submitConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setError('Both fields are required.');
      return;
    }
    saveRuntimeConfig({ url: url.trim(), anonKey: anonKey.trim() });
    // The Supabase client is created once at module load, so a reload is the
    // cleanest way to pick up brand-new credentials.
    window.location.reload();
  };

  const resetPassword = async () => {
    if (!emailInput.trim()) {
      setError('Enter your email address first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendPasswordReset(emailInput.trim());
      setNotice('Password reset link sent — check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4"
      style={{ backgroundColor: 'rgba(2,4,6,0.82)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div
        className="frost-panel w-full max-w-md p-6"
        style={{ borderColor: 'rgba(0,229,255,0.28)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Not configured: collect project credentials ───────────────── */}
        {!isCloudConfigured && (
          <>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-frost-cyan">
              Connect your database
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-frost-text-dim">
              Right now your weeks are saved to this device only. Paste your Supabase project
              details to sign in and sync everywhere. See{' '}
              <span className="font-mono text-frost-cyan/80">README.md</span> for the 5-minute
              setup.
            </p>

            <form onSubmit={submitConnect} className="mt-5 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
                  Project URL
                </span>
                <input
                  className="frost-input px-3 py-2 font-mono text-xs"
                  placeholder="https://xxxxxxxx.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
                  Anon public key
                </span>
                <input
                  className="frost-input px-3 py-2 font-mono text-xs"
                  placeholder="eyJhbGciOi…"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                />
              </label>

              {error && <p className="text-xs text-frost-danger">{error}</p>}

              <div className="mt-1 flex gap-2">
                <button
                  type="submit"
                  className="frost-glow flex-1 rounded-lg px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.15em]"
                  style={{ backgroundColor: 'var(--color-frost-cyan)', color: '#04141a' }}
                >
                  Connect
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border px-4 py-2.5 font-display text-[11px] uppercase tracking-[0.15em] text-frost-text-dim"
                  style={{ borderColor: 'var(--frost-border)' }}
                >
                  Later
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Configured + signed out: sign in / sign up ────────────────── */}
        {isCloudConfigured && !email && (
          <>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-frost-cyan">
              {tab === 'sign-in' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-frost-text-dim">
              Your weeks sync to your account, so they're on every device you sign in from.
            </p>

            <div className="mt-4 flex gap-1 rounded-lg p-1" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              {(['sign-in', 'sign-up'] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setTab(t);
                    setError(null);
                    setNotice(null);
                  }}
                  className="flex-1 rounded-md px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.15em] transition-colors"
                  style={
                    tab === t
                      ? { backgroundColor: 'rgba(0,229,255,0.14)', color: 'var(--color-frost-cyan-bright)' }
                      : { color: 'var(--color-frost-text-dim)' }
                  }
                >
                  {t === 'sign-in' ? 'Sign in' : 'Sign up'}
                </button>
              ))}
            </div>

            <form onSubmit={submitAuth} className="mt-4 flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
                  Email
                </span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  className="frost-input px-3 py-2 text-sm"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-display text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete={tab === 'sign-in' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  className="frost-input px-3 py-2 text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {error && <p className="text-xs text-frost-danger">{error}</p>}
              {notice && <p className="text-xs text-frost-cyan-bright">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className="frost-glow mt-1 rounded-lg px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.15em] disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-frost-cyan)', color: '#04141a' }}
              >
                {busy ? 'Working…' : tab === 'sign-in' ? 'Sign in' : 'Create account'}
              </button>

              <div className="flex items-center justify-between">
                {tab === 'sign-in' ? (
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="text-[11px] text-frost-text-dim underline-offset-2 hover:text-frost-cyan hover:underline"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-[11px] text-frost-text-dim underline-offset-2 hover:text-frost-cyan hover:underline"
                >
                  Keep using this device only
                </button>
              </div>
            </form>
          </>
        )}

        {/* ── Signed in ─────────────────────────────────────────────────── */}
        {isCloudConfigured && email && (
          <>
            <h2 className="font-display text-sm font-semibold uppercase tracking-[0.22em] text-frost-cyan">
              Account
            </h2>
            <dl className="mt-4 flex flex-col gap-3 text-[13px]">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-frost-text-dim">Signed in as</dt>
                <dd className="truncate font-mono text-frost-text">{email}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-frost-text-dim">Data</dt>
                <dd className="font-mono text-frost-cyan-bright">Synced to your account</dd>
              </div>
              {activeProjectUrl && (
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-frost-text-dim">Project</dt>
                  <dd className="truncate font-mono text-[11px] text-frost-text-dim">
                    {activeProjectUrl.replace('https://', '')}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={onClose}
                className="frost-glow rounded-lg px-4 py-2.5 font-display text-[11px] font-semibold uppercase tracking-[0.15em]"
                style={{ backgroundColor: 'var(--color-frost-cyan)', color: '#04141a' }}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => {
                  clearRuntimeConfig();
                  window.location.reload();
                }}
                className="text-[11px] text-frost-text-dim underline-offset-2 hover:text-frost-danger hover:underline"
              >
                Disconnect this database from this device
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
