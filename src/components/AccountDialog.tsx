import { useEffect, useRef, useState } from 'react';
import {
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  type Profile,
} from '../hooks/useAuth';
import { activeProjectId, isCloudConfigured } from '../lib/firebase';
import { GoogleMark } from './GoogleMark';

type Props = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSignOut: () => void;
  defaultTasks: string[];
  onSaveDefaultTasks: (tasks: string[]) => void;
};

/**
 * The tasks seeded into every day of a newly created week.
 *
 * Edits are debounced rather than saved per keystroke: the local write is
 * free, but each one is also a Firestore document write, and typing "Wake up
 * at 6:00" would be nineteen of them.
 */
function StandingTasks({
  tasks,
  onSave,
}: {
  tasks: string[];
  onSave: (tasks: string[]) => void;
}) {
  const [draft, setDraft] = useState<string[]>(tasks);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);

  // Adopt external changes (a sync from another device) only while idle, so a
  // late-arriving load can't overwrite something being typed right now.
  useEffect(() => {
    if (!timer.current) setDraft(tasks);
  }, [tasks]);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onSave(draft.map((t) => t.trim()).filter(Boolean));
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft, onSave]);

  const setAt = (i: number, value: string) =>
    setDraft((d) => d.map((t, idx) => (idx === i ? value : t)));
  const removeAt = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));

  return (
    <div className="mt-7">
      <h3 className="text-sm text-frost-text">Standing tasks</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-frost-text-faint">
        Seeded into every day of a new week, so you stop retyping your routine. Weeks you've
        already started are left alone.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {draft.map((task, i) => (
          <div key={i} className="flex items-center gap-3">
            <input
              value={task}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder="Something you do every day"
              aria-label={`Standing task ${i + 1}`}
              className="frost-field min-w-0 flex-1 text-sm"
            />
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${task || 'this task'}`}
              className="shrink-0 text-frost-text-faint transition-colors duration-150 hover:text-frost-alert"
            >
              <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" aria-hidden="true">
                <path
                  d="M1.2 1.2 8.8 8.8M8.8 1.2 1.2 8.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {draft.length < 20 && (
        <button
          type="button"
          onClick={() => setDraft((d) => [...d, ''])}
          className="mt-3 text-sm text-frost-text-dim transition-colors hover:text-frost-cyan-300"
        >
          + add a standing task
        </button>
      )}
    </div>
  );
}

/** Firebase throws `auth/…` codes at the UI. Say something a person can act on. */
function friendlyAuthError(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null; // Deliberate cancellation isn't an error worth reporting.
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'That email and password don’t match an account.';
    case 'auth/email-already-in-use':
      return 'There’s already an account with that email — sign in instead.';
    case 'auth/weak-password':
      return 'Password needs to be at least 6 characters.';
    case 'auth/invalid-email':
      return 'That doesn’t look like an email address.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a minute and try again.';
    case 'auth/network-request-failed':
      return 'No connection. Your work is saved on this device either way.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google popup — allow popups, or use email below.';
    case 'auth/operation-not-allowed':
      return 'That sign-in method isn’t enabled on this Firebase project yet.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorised in Firebase yet.';
    default:
      return err instanceof Error ? err.message : 'Could not sign in.';
  }
}

export function AccountDialog({
  open,
  onClose,
  profile,
  onSignOut,
  defaultTasks,
  onSaveDefaultTasks,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [withEmail, setWithEmail] = useState(false);
  const [creating, setCreating] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [password, setPassword] = useState('');

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

  // Not awaited before the popup opens: signInWithPopup has to be reached
  // synchronously from the click or the browser blocks it as unsolicited.
  const handleGoogle = () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    signInWithGoogle()
      .then(onClose)
      .catch((err: unknown) => setError(friendlyAuthError(err)))
      .finally(() => setBusy(false));
  };

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (creating) await signUp(emailInput.trim(), password);
      else await signIn(emailInput.trim(), password);
      onClose();
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
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
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      // Dimming black with more black separates nothing; the blur is what
      // actually pushes the page behind the dialog.
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div
        className="frost-rise w-full max-w-sm rounded-2xl p-7"
        style={{
          background:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), var(--color-frost-surface) 62%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isCloudConfigured && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">This device only</h2>
            <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
              Your weeks are saved here in this browser. To sign in with Google and have them
              follow you everywhere, add a Firebase config — the steps are in{' '}
              <span className="font-mono text-xs text-frost-cyan-300">
                src/lib/firebase-config.ts
              </span>
              .
            </p>

            <span className="frost-divider mt-7 block" />
            <StandingTasks tasks={defaultTasks} onSave={onSaveDefaultTasks} />

            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{
                backgroundColor: 'var(--color-frost-cyan-200)',
                color: 'var(--frost-on-accent)',
              }}
            >
              got it
            </button>
          </>
        )}

        {isCloudConfigured && !profile && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
              Your weeks follow you to any device you sign in from.
            </p>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={busy}
              className="mt-7 flex w-full items-center justify-center gap-3 rounded-lg px-5 py-3 text-sm transition-colors duration-150 disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: 'var(--frost-on-accent)' }}
            >
              <GoogleMark size={16} />
              {busy ? 'opening google…' : 'continue with google'}
            </button>

            {/* The escape hatch for a managed Chromebook that blocks OAuth
                popups. Folded away by default so the common path stays one
                button, not a form. */}
            {!withEmail && (
              <button
                type="button"
                onClick={() => setWithEmail(true)}
                className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
              >
                use an email and password instead
              </button>
            )}

            {withEmail && (
              <form onSubmit={submitEmail} className="mt-6 flex flex-col gap-4">
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-frost-text-faint">email</span>
                  <input
                    type="email"
                    autoComplete="email"
                    required
                    className="frost-field text-sm"
                    value={emailInput}
                    onChange={(ev) => setEmailInput(ev.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs text-frost-text-faint">password</span>
                  <input
                    type="password"
                    autoComplete={creating ? 'new-password' : 'current-password'}
                    required
                    minLength={6}
                    className="frost-field text-sm"
                    value={password}
                    onChange={(ev) => setPassword(ev.target.value)}
                  />
                </label>

                <button
                  type="submit"
                  disabled={busy}
                  className="mt-1 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150 disabled:opacity-50"
                  style={{ backgroundColor: 'var(--color-frost-cyan-300)', color: 'var(--frost-on-accent)' }}
                >
                  {busy ? 'working…' : creating ? 'create account' : 'sign in'}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(!creating);
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-frost-text-dim transition-colors hover:text-frost-cyan-300"
                  >
                    {creating ? 'i already have one' : 'create an account'}
                  </button>
                  {!creating && (
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
            )}

            {error && <p className="mt-4 text-sm text-frost-alert">{error}</p>}
            {notice && <p className="mt-4 text-sm text-frost-cyan-200">{notice}</p>}

            <button
              type="button"
              onClick={onClose}
              className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
            >
              later
            </button>
          </>
        )}

        {isCloudConfigured && profile && (
          <>
            <div className="flex items-center gap-4">
              <Avatar profile={profile} size={44} />
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg tracking-tight text-frost-text">
                  {profile.name ?? 'Signed in'}
                </h2>
                <p className="truncate font-mono text-xs text-frost-text-dim">{profile.email}</p>
              </div>
            </div>

            <dl className="mt-6 flex flex-col gap-3 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="text-frost-text-faint">data</dt>
                <dd className="font-mono text-frost-cyan-200">synced</dd>
              </div>
              {activeProjectId && (
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-frost-text-faint">project</dt>
                  <dd className="truncate font-mono text-xs text-frost-text-dim">
                    {activeProjectId}
                  </dd>
                </div>
              )}
            </dl>

            <span className="frost-divider mt-7 block" />
            <StandingTasks tasks={defaultTasks} onSave={onSaveDefaultTasks} />

            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{
                backgroundColor: 'var(--color-frost-cyan-200)',
                color: 'var(--frost-on-accent)',
              }}
            >
              done
            </button>
            <button
              type="button"
              onClick={() => {
                onSignOut();
                onClose();
              }}
              className="mt-4 w-full text-sm text-frost-text-faint transition-colors hover:text-frost-text-dim"
            >
              sign out
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Borderless and round, so it adds nothing to the bordered-element count. */
export function Avatar({ profile, size }: { profile: Profile; size: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (profile.name ?? profile.email ?? '?').trim().charAt(0).toUpperCase();

  if (profile.avatarUrl && !broken) {
    return (
      <img
        src={profile.avatarUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 place-items-center rounded-full font-display"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        backgroundColor: 'var(--color-frost-cyan-900)',
        color: 'var(--color-frost-cyan-200)',
      }}
    >
      {initial}
    </span>
  );
}
