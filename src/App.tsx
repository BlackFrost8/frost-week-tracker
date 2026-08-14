import { useEffect, useMemo, useState } from 'react';
import type { DayId } from './types';
import { useAuth, signOut } from './hooks/useAuth';
import { useClickRipple } from './hooks/useClickRipple';
import { usePrefs } from './hooks/usePrefs';
import { useWeek } from './hooks/useWeek';
import { cloudStore, localStore, migrateLocalToCloud } from './lib/storage';
import { completedCount, todayISO } from './lib/week';
import { AmbientBackground } from './components/AmbientBackground';
import { Header } from './components/Header';
import { IntentPanel } from './components/IntentPanel';
import { HeroPanel } from './components/HeroPanel';
import { PaceCurve } from './components/PaceCurve';
import { WeekStrip } from './components/WeekStrip';
import { DayCard } from './components/DayCard';
import { AccountDialog } from './components/AccountDialog';
import { ThemeDialog } from './components/ThemeDialog';

export default function App() {
  useClickRipple();

  const { mode, profile } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);
  const [migratedUid, setMigratedUid] = useState<string | null>(null);

  const signedIn = mode === 'signed-in';
  const uid = profile?.uid ?? null;
  const store = useMemo(() => (signedIn ? cloudStore : localStore), [signedIn]);

  /**
   * Nothing loads until migration for this account has finished. Without the
   * gate, `useWeek`'s load effect (registered first, because the hook is
   * called above the migration effect) would read an empty account, build a
   * blank starter week, and the next click would upload it straight over the
   * weeks migration had just moved in — while the banner said they'd arrived.
   */
  const migrationDone = !signedIn || migratedUid === uid;
  const authSettled = mode !== 'loading' && migrationDone;

  // Standing tasks have to be known before a week is created, or a brand-new
  // week gets built empty and never picks them up.
  const { prefs, prefsReady, updateDefaultTasks } = usePrefs(authSettled, uid);
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
    flush,
  } = useWeek(store, ready, prefs.defaultTasks);

  useEffect(() => {
    if (!signedIn || !uid || migratedUid === uid) return;
    let active = true;
    migrateLocalToCloud()
      .then((count) => {
        if (active && count > 0) {
          setMigrationNote(`${count} week${count === 1 ? '' : 's'} moved into your account.`);
          setTimeout(() => active && setMigrationNote(null), 6000);
        }
      })
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

  const today = todayISO();
  const todayDay = week?.days.find((d) => d.date === today) ?? null;

  // The strip selects; the card shows. On a week that doesn't contain today
  // there is still always a focal card — Monday is simply what's selected.
  const [selected, setSelected] = useState<DayId>('mon');
  useEffect(() => {
    setSelected(todayDay ? todayDay.id : 'mon');
  }, [weekStart, todayDay]);

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
          onOpenAccount={() => setAccountOpen(true)}
          onOpenTheme={() => setThemeOpen(true)}
        />

        {(error || migrationNote) && (
          <p
            className="font-mono text-sm"
            style={{
              color: error ? 'var(--color-frost-alert)' : 'var(--color-frost-cyan-200)',
            }}
            role={error ? 'alert' : 'status'}
          >
            {error ?? migrationNote}
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
        onSaveDefaultTasks={updateDefaultTasks}
      />

      <ThemeDialog open={themeOpen} onClose={() => setThemeOpen(false)} />
    </>
  );
}
