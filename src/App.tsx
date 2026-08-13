import { useEffect, useMemo, useState } from 'react';
import type { DayId } from './types';
import { useAuth, signOut } from './hooks/useAuth';
import { useWeek } from './hooks/useWeek';
import { cloudStore, localStore, migrateLocalToCloud } from './lib/storage';
import { todayISO } from './lib/week';
import { AmbientBackground } from './components/AmbientBackground';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { HeroPanel } from './components/HeroPanel';
import { TodayCard } from './components/TodayCard';
import { DayRow } from './components/DayRow';
import { AccountDialog } from './components/AccountDialog';

export default function App() {
  const { mode, email } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);

  const signedIn = mode === 'signed-in';
  const store = useMemo(() => (signedIn ? cloudStore : localStore), [signedIn]);
  const ready = mode !== 'loading';

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
  } = useWeek(store, ready);

  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    migrateLocalToCloud()
      .then((count) => {
        if (active && count > 0) {
          setMigrationNote(`${count} week${count === 1 ? '' : 's'} moved into your account.`);
          setTimeout(() => active && setMigrationNote(null), 6000);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [signedIn]);

  const today = todayISO();
  const todayDay = week?.days.find((d) => d.date === today) ?? null;

  // When viewing a week that doesn't contain today, there is no "today" card to
  // feature — so open Monday instead of showing seven collapsed rows.
  const [expanded, setExpanded] = useState<DayId | null>(null);
  useEffect(() => {
    setExpanded(todayDay ? null : 'mon');
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

  const handlers = (dayId: DayId) => ({
    onToggle: (taskId: string) => toggleTask(dayId, taskId),
    onLabelChange: (taskId: string, label: string) => setTaskLabel(dayId, taskId, label),
    onDelete: (taskId: string) => removeTask(dayId, taskId),
    onAdd: () => addTask(dayId),
  });

  const restOfWeek = week.days.filter((d) => d.id !== todayDay?.id);

  return (
    <>
      <AmbientBackground />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col gap-12 px-6 py-8 sm:px-8 sm:py-10">
        <Header
          weekStart={weekStart}
          knownWeeks={knownWeeks}
          onGoToWeek={goToWeek}
          sync={sync}
          email={email}
          onSignOut={handleSignOut}
          onOpenAccount={() => setAccountOpen(true)}
        />

        {(error || migrationNote) && (
          <p
            className="font-mono text-sm"
            style={{ color: error ? '#c96b7a' : 'var(--color-frost-cyan-300)' }}
            role={error ? 'alert' : 'status'}
          >
            {error ?? migrationNote}
          </p>
        )}

        <ControlPanel week={week} onSave={setMeta} onClearChecks={clearChecks} />

        <main className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-16">
          <div className="lg:col-start-2 lg:row-start-1">
            <HeroPanel week={week} />
          </div>

          {todayDay && (
            <div className="lg:col-start-1 lg:row-start-1 lg:row-span-2">
              <TodayCard day={todayDay} {...handlers(todayDay.id)} />
            </div>
          )}

          <div
            className={
              todayDay
                ? 'lg:col-start-2 lg:row-start-2'
                : 'lg:col-start-1 lg:row-start-1 lg:row-span-2'
            }
          >
            {todayDay && (
              <p className="mb-1 text-xs text-frost-text-faint">the rest of the week</p>
            )}
            {restOfWeek.map((day) => (
              <DayRow
                key={day.id}
                day={day}
                expanded={expanded === day.id}
                onExpand={() => setExpanded((cur) => (cur === day.id ? null : day.id))}
                {...handlers(day.id)}
              />
            ))}
          </div>
        </main>
      </div>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} email={email} />
    </>
  );
}
