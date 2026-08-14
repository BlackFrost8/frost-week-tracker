import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DayId } from './types';
import type { StandingTask } from './lib/prefs';
import { useAuth, signOut } from './hooks/useAuth';
import { useClickRipple } from './hooks/useClickRipple';
import { usePrefs } from './hooks/usePrefs';
import { useTheme } from './hooks/useTheme';
import { useWeek } from './hooks/useWeek';
import { cloudStore, localStore, migrateLocalToCloud } from './lib/storage';
import { DAY_IDS, completedCount, todayISO, weekOverallPct } from './lib/week';
import { paintFavicon } from './lib/favicon';
import { AmbientBackground } from './components/AmbientBackground';
import { Header } from './components/Header';
import { IntentPanel } from './components/IntentPanel';
import { HeroPanel } from './components/HeroPanel';
import { PaceCurve } from './components/PaceCurve';
import { WeekStrip } from './components/WeekStrip';
import { DayCard } from './components/DayCard';
import { AccountDialog } from './components/AccountDialog';
import { InfoDialog } from './components/InfoDialog';
import { ThemeDialog } from './components/ThemeDialog';

export default function App() {
  useClickRipple();

  // Lifted out of ThemeDialog: the header's wordmark renders the theme's
  // name, so both need the same instance of that state.
  const theme = useTheme();

  const { mode, profile } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [migratedUid, setMigratedUid] = useState<string | null>(null);

  const signedIn = mode === 'signed-in';
  const uid = profile?.uid ?? null;
  const store = useMemo(() => (signedIn ? cloudStore : localStore), [signedIn]);

  /**
   * Nothing loads until migration for this account has finished. Without the
   * gate, `useWeek`'s load effect (registered first, because the hook is
   * called above the migration effect) would read an empty account, build a
   * blank starter week, and the next click would upload it straight over the
   * weeks migration had just moved in.
   */
  const migrationDone = !signedIn || migratedUid === uid;
  const authSettled = mode !== 'loading' && migrationDone;

  // Standing tasks have to be known before a week is created, or a brand-new
  // week gets built empty and never picks them up.
  const { prefs, prefsReady, updatePrefs } = usePrefs(authSettled, uid);
  const ready = authSettled && prefsReady;

  const {
    week,
    weekStart,
    knownWeeks,
    sync,
    error,
    goToWeek,
    toggleTask,
    setTaskLabel,
    addTask,
    removeTask,
    setMeta,
    clearChecks,
    applyStandingTasks,
    flush,
  } = useWeek(store, ready, prefs.defaultTasks);

  /* Weeks built while signed out are pulled into the account on first sign-in.
     It is deliberately silent: being signed in is the whole promise that your
     work is kept, so announcing that it worked invites the reader to wonder
     when it doesn't. The only visible outcome is the weeks simply being there. */
  useEffect(() => {
    if (!signedIn || !uid || migratedUid === uid) return;
    let active = true;
    migrateLocalToCloud()
      .catch(() => {
        /* Offline, or the rules aren't published yet. The local copy is
           untouched and the flag is never set, so the next sign-in retries. */
      })
      .finally(() => {
        // Opens the gate either way: a failed migration must not wedge the app.
        if (active) setMigratedUid(uid);
      });
    return () => {
      active = false;
    };
  }, [signedIn, uid, migratedUid]);

  /* Stable identities: `StandingTasks` debounces on a 600ms timer, and a
     callback that changed on every render would re-arm the timer each time
     saving lifted state back up here. */
  const saveDefaultTasks = useCallback(
    (defaultTasks: StandingTask[]) => void updatePrefs({ defaultTasks }),
    [updatePrefs],
  );
  const saveAvatar = useCallback(
    (avatar: string | null) => void updatePrefs({ avatar }),
    [updatePrefs],
  );

  const today = todayISO();
  const todayDay = week?.days.find((d) => d.date === today) ?? null;

  /**
   * The strip selects; the card shows. On a week that doesn't contain today
   * there is still always a focal card — Monday is simply what's selected.
   *
   * Seeded to the current weekday rather than to Monday. The first week shown
   * is always the current one, so starting on Monday meant rendering the wrong
   * card and correcting it in the effect below one frame later. That was
   * visible as a flash, and the empty-day prompts made it costly: Monday
   * claimed three prompts, today claimed three more, and the first three were
   * marked as seen without anybody having seen them.
   */
  const [selected, setSelected] = useState<DayId>(() => DAY_IDS[(new Date().getDay() + 6) % 7]);

  /* Depend on the day's ID and a boolean, never on `week` or `todayDay`
     themselves.

     Every edit rebuilds the week — `mutate` returns a new object — and
     `todayDay` is a fresh `.find()` result on top of that, so both change
     identity on each keystroke while meaning exactly the same thing. Naming
     them here re-ran this effect after every edit and reset the selection,
     which is why adding a task to any day other than today threw you back to
     today mid-sentence. The ID is a string: it only changes when the day
     genuinely does, including over midnight. */
  const todayId = todayDay?.id ?? null;
  const weekLoaded = week !== null;

  useEffect(() => {
    // Not while the week is still loading. `todayId` is null until it lands,
    // so an unguarded run reads that as "this week has no today" and falls
    // back to Monday — overwriting the correct seed above, and then correcting
    // itself once the week arrives. The card in between is a real render.
    if (!weekLoaded) return;
    setSelected(todayId ?? 'mon');
  }, [weekLoaded, weekStart, todayId]);

  /* The tab carries the app's identity, and the app's identity is whatever the
     theme is called — including a name typed by hand in the advanced picker.
     A second, fixed title sitting in the tab was just a older name for the
     same thing. */
  const tabName = theme.name.trim();
  useEffect(() => {
    document.title = tabName || 'Week tracker';
  }, [tabName]);

  /* The ring in the tab is the same number as the ring on the page. Redrawn
     from the week rather than stored, so it cannot drift from the checkboxes,
     and in the theme's own accent so the tab matches the screen.

     Deliberately outside the `if (!week)` early return below — hooks cannot be
     called conditionally, and the loading state still wants a sane icon. */
  const weekPct = week ? weekOverallPct(week) : 0;
  useEffect(() => {
    paintFavicon(weekPct, theme.spec.accent, theme.spec.primary);
  }, [weekPct, theme.spec.accent, theme.spec.primary]);

  const handleSignOut = async () => {
    await flush();
    await signOut();
  };

  if (!week) {
    return (
      <>
        <AmbientBackground />
        <div className="relative z-10 grid min-h-screen place-items-center">
          <div
            className="frost-spin h-6 w-6 rounded-full border border-transparent"
            style={{ borderTopColor: 'var(--color-frost-cyan-500)' }}
            role="status"
            aria-label="Loading"
          />
        </div>
      </>
    );
  }

  const selectedDay = week.days.find((d) => d.id === selected) ?? week.days[0];
  const doneToday = todayDay ? completedCount(todayDay) : 0;

  const handlers = {
    onToggle: (taskId: string) => toggleTask(selectedDay.id, taskId),
    onLabelChange: (taskId: string, label: string) =>
      setTaskLabel(selectedDay.id, taskId, label),
    onDelete: (taskId: string) => removeTask(selectedDay.id, taskId),
    onAdd: () => addTask(selectedDay.id),
  };

  return (
    <>
      <AmbientBackground />

      {/* 1152px was capping the shell on every desktop, so a 1440p monitor spent
          55% of its width on empty black. The strip below is what earns the extra
          width — no text measure grows. */}
      <div className="frost-shell relative z-10 flex min-h-screen flex-col gap-16 sm:gap-24">
        <Header
          weekStart={weekStart}
          knownWeeks={knownWeeks}
          onGoToWeek={goToWeek}
          sync={sync}
          profile={profile}
          avatar={prefs.avatar}
          onOpenAccount={() => setAccountOpen(true)}
          onOpenTheme={() => setThemeOpen(true)}
          wordmark={theme.name}
        />

        {error && (
          <p
            className="font-mono text-sm"
            style={{ color: 'var(--color-frost-alert)' }}
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Chrome -> work is now the largest interval on the page (96px), and the
            strip groups with the work it orients rather than with the header. */}
        <div className="flex flex-col gap-12">
          <WeekStrip
            days={week.days}
            selected={selected}
            today={today}
            onSelect={setSelected}
          />

          <main className="grid gap-12 md:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[300px_minmax(0,1fr)_300px] 2xl:grid-cols-[340px_minmax(0,1fr)_340px]">
            {/* Read-only, so their placement can vary across breakpoints without
                ever disagreeing with keyboard order. The curve is a separate
                grid item so that on a phone it falls below the card — stacked
                with the hero it pushed the day's tasks ~230px further down. */}
            <div className="flex flex-col gap-6 md:col-start-2 md:row-start-1 xl:col-start-1 xl:row-start-1">
              <HeroPanel week={week} />
              {todayDay && (
                <p className="text-center font-mono text-sm text-frost-text-dim">
                  <span className="text-frost-cyan-200">+{doneToday}</span> today
                </p>
              )}
            </div>

            {/* Capped and centred rather than filling its column: extra width
                becomes symmetric gutter instead of a hole to the right of a
                490px text measure. */}
            <div className="mx-auto w-full max-w-[660px] md:col-start-1 md:row-start-1 md:row-span-3 xl:col-start-2 xl:row-start-1 xl:row-span-2">
              <DayCard
                day={selectedDay}
                isToday={selectedDay.date === today}
                {...handlers}
              />
            </div>

            <div className="md:col-start-2 md:row-start-2 xl:col-start-1 xl:row-start-2">
              <PaceCurve week={week} />
            </div>

            <div className="md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-1">
              <IntentPanel week={week} onSave={setMeta} onClearChecks={clearChecks} />
            </div>
          </main>
        </div>
      </div>

      <AccountDialog
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        profile={profile}
        onSignOut={handleSignOut}
        defaultTasks={prefs.defaultTasks}
        onSaveDefaultTasks={saveDefaultTasks}
        onApplyToWeek={applyStandingTasks}
        avatar={prefs.avatar}
        onSaveAvatar={saveAvatar}
      />

      <ThemeDialog open={themeOpen} onClose={() => setThemeOpen(false)} theme={theme} />

      {/* Owns its own open state — nothing else in the app needs to know, and
          the button is part of the feature rather than a separate control. */}
      <InfoDialog />
    </>
  );
}
