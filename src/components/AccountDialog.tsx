import { useEffect, useRef, useState } from 'react';
import type { DayId } from '../types';
import {
  sendPasswordReset,
  signIn,
  signInWithGoogle,
  signUp,
  type Profile,
} from '../hooks/useAuth';
import { useDialog } from '../hooks/useDialog';
import { fileToAvatar } from '../lib/avatar';
import { isCloudConfigured } from '../lib/firebase';
import type { StandingTask } from '../lib/prefs';
import { DAY_IDS, DAY_LABELS, DAY_SHORT } from '../lib/week';
import { GoogleMark } from './GoogleMark';

type Props = {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onSignOut: () => void;
  defaultTasks: StandingTask[];
  onSaveDefaultTasks: (tasks: StandingTask[]) => void;
  onApplyToWeek: (tasks: StandingTask[]) => void;
  avatar: string | null;
  onSaveAvatar: (avatar: string | null) => void;
};

/** Trim, and drop the rows that are still blank. Days are left exactly as set. */
function clean(tasks: StandingTask[]): StandingTask[] {
  return tasks.map((t) => ({ ...t, label: t.label.trim() })).filter((t) => t.label !== '');
}

/**
 * The tasks seeded into a newly created week, and the days each one lands on.
 *
 * Edits are debounced rather than saved per keystroke: the local write is
 * free, but each one is also a Firestore document write, and typing "Wake up
 * at 6:00" would be nineteen of them.
 */
function StandingTasks({
  tasks,
  onSave,
  onApplyToWeek,
}: {
  tasks: StandingTask[];
  onSave: (tasks: StandingTask[]) => void;
  onApplyToWeek: (tasks: StandingTask[]) => void;
}) {
  const [draft, setDraft] = useState<StandingTask[]>(tasks);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(false);
  const [applied, setApplied] = useState(false);

  /* Held in a ref, and deliberately not an effect dependency: saving lifts
     state in the parent, so a fresh `onSave` identity arrives on every save
     and would re-arm the timer that had just fired — a write every 600ms,
     forever. The effect depends on the draft alone. */
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  /* There is deliberately NO effect syncing `draft` back from `tasks`.
     `onSave` strips blank rows before persisting, so a "sync from props" step
     would fire 600ms after you pressed "add a standing task" and delete the
     empty row you were about to type into — which is exactly what it did.
     The dialog unmounts this component when it closes, so the initial state
     above is the only sync that's needed. */

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      onSaveRef.current(clean(draft));
    }, 600);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [draft]);

  const setAt = (i: number, label: string) =>
    setDraft((d) => d.map((t, idx) => (idx === i ? { ...t, label } : t)));

  const removeAt = (i: number) => setDraft((d) => d.filter((_, idx) => idx !== i));

  const toggleDay = (i: number, day: DayId) =>
    setDraft((d) =>
      d.map((t, idx) =>
        idx === i
          ? {
              ...t,
              // Filtering the canonical order keeps the stored array stable
              // rather than appending days in the order they were clicked.
              days: t.days.includes(day)
                ? t.days.filter((x) => x !== day)
                : DAY_IDS.filter((x) => x === day || t.days.includes(x)),
            }
          : t,
      ),
    );

  return (
    <div className="mt-7">
      <h3 className="text-sm text-frost-text">Standing tasks</h3>
      <p className="mt-1.5 text-xs leading-relaxed text-frost-text-faint">
        Seeded into a new week, so you stop retyping your routine. Switch off the days a task
        doesn't belong on. Weeks you've already started are left alone.
      </p>

      <div className="mt-4 flex flex-col gap-5">
        {draft.map((task, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <input
                value={task.label}
                onChange={(e) => setAt(i, e.target.value)}
                placeholder="Something you do every day"
                aria-label={`Standing task ${i + 1}`}
                className="frost-field min-w-0 flex-1 text-sm"
              />
              <button
                type="button"
                onClick={() => removeAt(i)}
                aria-label={`Remove ${task.label || 'this task'}`}
                // Padded to a real target: the icon is 10px, which is a fine
                // thing to look at and an impossible thing to tap.
                className="-m-2 grid h-9 w-9 shrink-0 place-items-center rounded text-frost-text-faint transition-colors duration-150 hover:text-frost-alert"
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

            {/* A seven-column grid rather than a flex row: the cells divide the
                dialog evenly at any width instead of wrapping a lone "su" onto
                a second line, and it echoes the week strip's own geometry. */}
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Days">
              {DAY_IDS.map((id) => {
                const on = task.days.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => toggleDay(i, id)}
                    aria-pressed={on}
                    aria-label={`${DAY_LABELS[id]} — ${task.label || `standing task ${i + 1}`}`}
                    title={DAY_LABELS[id]}
                    className={`rounded py-2 text-center font-mono text-xs lowercase transition-colors duration-150 ${
                      on
                        ? 'bg-frost-cyan-900 text-frost-cyan-200'
                        : 'text-frost-text-faint hover:text-frost-text-dim'
                    }`}
                  >
                    {/* Two letters, lower case: the wordmark keeps the app's
                        one uppercase slot. */}
                    {DAY_SHORT[id].slice(0, 2)}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
        {draft.length < 20 && (
          <button
            type="button"
            onClick={() => setDraft((d) => [...d, { label: '', days: [...DAY_IDS] }])}
            className="text-sm text-frost-text-dim transition-colors hover:text-frost-cyan-300"
          >
            + add a standing task
          </button>
        )}

        {/* New weeks pick these up on their own. This is for the week you're
            already in, which is deliberately never rewritten behind your back —
            so applying it is an explicit act, and it only ever adds what's
            missing. Nothing is renamed, reordered or removed. */}
        {draft.some((t) => t.label.trim()) && (
          <button
            type="button"
            onClick={() => {
              onApplyToWeek(clean(draft));
              setApplied(true);
              setTimeout(() => setApplied(false), 2500);
            }}
            className="text-sm text-frost-text-faint transition-colors hover:text-frost-cyan-300"
          >
            {applied ? 'added to this week' : 'add these to this week'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The avatar, and the two ways it can change: a file off the device, or back
 * to whatever the account came with.
 */
function PhotoPicker({
  profile,
  avatar,
  onSave,
}: {
  profile: Profile;
  avatar: string | null;
  onSave: (avatar: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Cleared before the await, or picking the same file twice in a row is a
    // no-op — the input's value never changed, so it fires no event.
    e.target.value = '';
    if (!file) return;

    setBusy(true);
    setError(null);
    try {
      onSave(await fileToAvatar(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : "That image couldn't be used.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          aria-label="Change your picture"
          title="Change your picture"
          className="rounded-full transition-opacity duration-150 hover:opacity-75 disabled:opacity-50"
        >
          <Avatar profile={profile} src={avatar ?? profile.avatarUrl} size={44} />
        </button>

        <div className="min-w-0">
          <h2 className="truncate font-display text-lg tracking-tight text-frost-text">
            {profile.name ?? 'Signed in'}
          </h2>
          <p className="truncate font-mono text-xs text-frost-text-dim">{profile.email}</p>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={choose}
        className="hidden"
        tabIndex={-1}
      />

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="text-sm text-frost-text-dim transition-colors hover:text-frost-cyan-300 disabled:opacity-50"
        >
          {busy ? 'resizing…' : 'change picture'}
        </button>

        {avatar && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onSave(null);
            }}
            className="text-sm text-frost-text-faint transition-colors hover:text-frost-cyan-300"
          >
            {/* Clearing the custom picture reveals the one the account already
                had, so say which of the two actually happens. */}
            {profile.avatarUrl ? 'use google picture' : 'remove'}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-sm text-frost-alert">{error}</p>}
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
    /* The two below are setup faults, not user faults. They used to name the
       backend and the console screen you'd fix them on, which tells the person
       staring at the message nothing they can act on and tells everyone else
       how the app is wired. Both are now stated as availability. */
    case 'auth/operation-not-allowed':
      return 'That way of signing in isn’t available right now.';
    case 'auth/unauthorized-domain':
      return 'Signing in isn’t available on this address.';
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
  onApplyToWeek,
  avatar,
  onSaveAvatar,
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

  // Escape, focus containment and focus restoration all live in the hook.
  const panelRef = useDialog(open, onClose);

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
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-5"
      // Dimming black with more black separates nothing; the blur is what
      // actually pushes the page behind the dialog.
      style={{ backgroundColor: 'rgb(var(--frost-base-rgb) / 0.72)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Account"
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        className="frost-rise my-auto w-full max-w-sm rounded-2xl p-7 focus:outline-none"
        style={{
          background:
            'radial-gradient(130% 110% at 0% 0%, rgb(var(--frost-accent-rgb) / 0.075), var(--color-frost-surface) 62%)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!isCloudConfigured && (
          <>
            <h2 className="font-display text-lg tracking-tight text-frost-text">This device only</h2>
            {/* Only ever reachable in a build with no config, i.e. a fork that
                hasn't been set up. The steps live in src/lib/firebase-config.ts
                and README.md — the person who needs them is reading the repo,
                not this dialog. */}
            <p className="mt-2 text-sm leading-relaxed text-frost-text-dim">
              Your weeks are saved here in this browser. Signing in isn’t set up on this copy of
              the app.
            </p>

            <span className="frost-divider mt-7 block" />
            <StandingTasks
              tasks={defaultTasks}
              onSave={onSaveDefaultTasks}
              onApplyToWeek={onApplyToWeek}
            />

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
            <PhotoPicker profile={profile} avatar={avatar} onSave={onSaveAvatar} />

            <span className="frost-divider mt-7 block" />
            <StandingTasks
              tasks={defaultTasks}
              onSave={onSaveDefaultTasks}
              onApplyToWeek={onApplyToWeek}
            />

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
export function Avatar({
  profile,
  src,
  size,
}: {
  profile: Profile;
  /** The picture to draw. Falls back to the initial when null or unloadable. */
  src: string | null;
  size: number;
}) {
  const [broken, setBroken] = useState(false);
  const initial = (profile.name ?? profile.email ?? '?').trim().charAt(0).toUpperCase();

  // A new picture deserves its own attempt: without this, one failed Google
  // URL would leave the initial showing over every replacement chosen after.
  useEffect(() => setBroken(false), [src]);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        // Google's photo host 403s a request that carries this app as its
        // referrer, which is the usual reason a signed-in avatar renders as a
        // grey square.
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
