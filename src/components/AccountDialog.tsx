import { useEffect, useState } from 'react';
import { signInWithGoogle, type Profile } from '../hooks/useAuth';
import { activeProjectId, isCloudConfigured } from '../lib/firebase';
import { GoogleMark } from './GoogleMark';

type Props = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSignOut: () => void;
};

export function AccountDialog({ open, onClose, profile, onSignOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
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
    signInWithGoogle()
      .then(onClose)
      .catch((err: unknown) => {
        const code = (err as { code?: string })?.code ?? '';
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          setError(null);
        } else if (code === 'auth/unauthorized-domain') {
          setError('This domain is not authorised in Firebase yet.');
        } else {
          setError(err instanceof Error ? err.message : 'Could not sign in.');
        }
      })
      .finally(() => setBusy(false));
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center p-5"
      // Dimming black with more black separates nothing; the blur is what
      // actually pushes the page behind the dialog.
      style={{ backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div
        className="frost-rise w-full max-w-sm rounded-2xl p-7"
        style={{
          background:
            'radial-gradient(130% 110% at 0% 0%, rgba(0,239,255,0.075), rgba(0,8,8,0.94) 62%)',
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
            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: '#000000' }}
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
              style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: '#000000' }}
            >
              <GoogleMark size={16} />
              {busy ? 'opening google…' : 'continue with google'}
            </button>

            {error && <p className="mt-4 text-sm text-frost-alert">{error}</p>}

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

            <button
              type="button"
              onClick={onClose}
              className="mt-7 w-full rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{ backgroundColor: 'var(--color-frost-cyan-200)', color: '#000000' }}
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
