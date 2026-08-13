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

  const primaryButton = 'w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150';
  const primaryStyle = { backgroundColor: 'var(--color-frost-cyan-500)', color: '#000000' };

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
        if (needsConfirm) setNotice('Account created. Confirm via the email we sent, then sign in.');
        else onClose();
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
      setNotice('Reset link sent — check your inbox.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send reset email.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div
        className="frost-rise w-full max-w-sm rounded-2xl p-7"
        style={{ backgroundColor: 'var(--color-frost-surface)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isCloudConfigured && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">
              Connect your database
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
              Your weeks are on this device only. Paste your Supabase project details to sync
              everywhere. Setup steps are in the README.
            </p>

            <form onSubmit={submitConnect} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-frost-text-faint">project url</span>
                <input
                  className="frost-field font-mono text-xs"
                  placeholder="https://xxxxxxxx.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-frost-text-faint">anon public key</span>
                <input
                  className="frost-field font-mono text-xs"
                  placeholder="eyJhbGciOi…"
                  value={anonKey}
                  onChange={(e) => setAnonKey(e.target.value)}
                />
              </label>

              {error && <p className="text-sm text-frost-text-dim">{error}</p>}

              <button type="submit" className={`${primaryButton} mt-1`} style={primaryStyle}>
                connect
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
              >
                later
              </button>
            </form>
          </>
        )}

        {isCloudConfigured && !email && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">
              {tab === 'sign-in' ? 'Sign in' : 'Create account'}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
              Your weeks follow you to any device you sign in from.
            </p>

            <form onSubmit={submitAuth} className="mt-6 flex flex-col gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-frost-text-faint">email</span>
                <input
                  type="email"
                  autoComplete="email"
                  required
                  className="frost-field text-sm"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs text-frost-text-faint">password</span>
                <input
                  type="password"
                  autoComplete={tab === 'sign-in' ? 'current-password' : 'new-password'}
                  required
                  minLength={6}
                  className="frost-field text-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>

              {error && <p className="text-sm text-frost-text-dim">{error}</p>}
              {notice && <p className="text-sm text-frost-cyan-300">{notice}</p>}

              <button
                type="submit"
                disabled={busy}
                className={`${primaryButton} mt-1 disabled:opacity-50`}
                style={primaryStyle}
              >
                {busy ? 'working…' : tab === 'sign-in' ? 'sign in' : 'create account'}
              </button>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setTab(tab === 'sign-in' ? 'sign-up' : 'sign-in');
                    setError(null);
                    setNotice(null);
                  }}
                  className="text-frost-text-dim transition-colors hover:text-frost-cyan-300"
                >
                  {tab === 'sign-in' ? 'create an account' : 'i already have one'}
                </button>
                {tab === 'sign-in' && (
                  <button
                    type="button"
                    onClick={resetPassword}
                    className="text-frost-text-faint transition-colors hover:text-frost-text-dim"
                  >
                    forgot password
                  </button>
                )}
              </div>
            </form>
          </>
        )}

        {isCloudConfigured && email && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">Account</h2>
            <dl className="mt-5 flex flex-col gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-frost-text-faint">signed in as</dt>
                <dd className="truncate font-mono text-frost-text">{email}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-frost-text-faint">data</dt>
                <dd className="font-mono text-frost-cyan-300">synced</dd>
              </div>
              {activeProjectUrl && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-frost-text-faint">project</dt>
                  <dd className="truncate font-mono text-xs text-frost-text-dim">
                    {activeProjectUrl.replace('https://', '')}
                  </dd>
                </div>
              )}
            </dl>

            <button
              type="button"
              onClick={onClose}
              className={`${primaryButton} mt-7`}
              style={primaryStyle}
            >
              done
            </button>
            <button
              type="button"
              onClick={() => {
                clearRuntimeConfig();
                window.location.reload();
              }}
              className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
            >
              disconnect this database
            </button>
          </>
        )}
      </div>
    </div>
  );
}
