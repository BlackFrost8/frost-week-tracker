import { useEffect, useMemo, useState } from 'react';
import type { DayId } from './types';
import { useAuth, signOut } from './hooks/useAuth';
import { useWeek } from './hooks/useWeek';
import { cloudStore, localStore, migrateLocalToCloud } from './lib/storage';
import { DAY_SHORT, completionPct, todayISO } from './lib/week';
import { Header } from './components/Header';
import { ControlPanel } from './components/ControlPanel';
import { WeekOverview } from './components/WeekOverview';
import { DayColumn } from './components/DayColumn';
import { AccountDialog } from './components/AccountDialog';

export default function App() {
  const { mode, email } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [migrationNote, setMigrationNote] = useState<string | null>(null);

  const signedIn = mode === 'signed-in';
  const store = useMemo(() => (signedIn ? cloudStore : localStore), [signedIn]);
  // Hold off on loading until we know whether there's a session, so we don't
  // read from localStorage and then immediately re-read from the cloud.
  const ready = mode !== 'loading';

  const {
    week,
    weekStart,
    knownWeeks,
    loading,
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

  /* Carry anything built offline into the account on first sign-in. */
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    migrateLocalToCloud()
      .then((count) => {
        if (active && count > 0) {
          setMigrationNote(`${count} week${count === 1 ? '' : 's'} moved from this device into your account.`);
          setTimeout(() => active && setMigrationNote(null), 6000);
        }
      })
      .catch(() => {
        /* Non-fatal — local data stays put and can be retried on next sign-in. */
      });
    return () => {
      active = false;
    };
  }, [signedIn]);

  const today = todayISO();
  const [mobileDay, setMobileDay] = useState<DayId>('mon');

  // Open the mobile view on today's column when today is in the shown week.
  useEffect(() => {
    if (!week) return;
    const match = week.days.find((d) => d.date === today);
    if (match) setMobileDay(match.id);
    else setMobileDay('mon');
  }, [week, today]);

  const handleSignOut = async () => {
    await flush();
    await signOut();
  };

  if (!week) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="frost-spin h-8 w-8 rounded-full border-2 border-transparent"
            style={{ borderTopColor: 'var(--color-frost-cyan)' }}
          />
          <p className="font-display text-[10px] uppercase tracking-[0.3em] text-frost-text-dim">
            Loading
          </p>
        </div>
      </div>
    );
  }

  const dayProps = (dayId: DayId) => ({
    onToggle: (taskId: string) => toggleTask(dayId, taskId),
    onLabelChange: (taskId: string, label: string) => setTaskLabel(dayId, taskId, label),
    onDelete: (taskId: string) => removeTask(dayId, taskId),
    onAdd: () => addTask(dayId),
  });

  const activeDay = week.days.find((d) => d.id === mobileDay) ?? week.days[0];

  return (
    <div className="relative z-10 mx-auto flex min-h-screen max-w-[1800px] flex-col gap-4 p-4 sm:p-6">
      <Header
        weekStart={weekStart}
        knownWeeks={knownWeeks}
        onGoToWeek={goToWeek}
        sync={sync}
        storageKind={store.kind}
        email={email}
        onSignOut={handleSignOut}
        onOpenAccount={() => setAccountOpen(true)}
      />

      {error && (
        <div
          className="rounded-lg px-4 py-2.5 text-[13px]"
          style={{
            border: '1px solid rgba(255,84,112,0.35)',
            backgroundColor: 'rgba(255,84,112,0.07)',
            color: 'var(--color-frost-danger)',
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      {migrationNote && (
        <div
          className="rounded-lg px-4 py-2.5 text-[13px]"
          style={{
            border: '1px solid rgba(0,229,255,0.3)',
            backgroundColor: 'rgba(0,229,255,0.06)',
            color: 'var(--color-frost-cyan-bright)',
          }}
          role="status"
        >
          {migrationNote}
        </div>
      )}

      <ControlPanel week={week} onSave={setMeta} onClearChecks={clearChecks} />

      <WeekOverview week={week} />

      {/* Mobile: day-selector strip + one day at a time */}
      <div className="sm:hidden">
        <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
          {week.days.map((d) => {
            const pct = completionPct(d);
            const active = d.id === mobileDay;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setMobileDay(d.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-display text-[10px] uppercase tracking-[0.12em] transition-all"
                style={{
                  borderColor: active ? 'rgba(0,229,255,0.5)' : 'var(--frost-border)',
                  backgroundColor: active ? 'rgba(0,229,255,0.1)' : 'transparent',
                  color: active ? 'var(--color-frost-cyan-bright)' : 'var(--color-frost-text-dim)',
                }}
              >
                {DAY_SHORT[d.id]}
                <span className="font-mono text-[9px] tabular-nums opacity-70">{pct}%</span>
              </button>
            );
          })}
        </div>

        <DayColumn
          key={activeDay.id}
          day={activeDay}
          isToday={activeDay.date === today}
          index={0}
          {...dayProps(activeDay.id)}
        />
      </div>

      {/* Tablet wraps, desktop goes 7-across */}
      <div className="hidden gap-3 sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {week.days.map((day, i) => (
          <DayColumn
            key={day.id}
            day={day}
            isToday={day.date === today}
            index={i}
            {...dayProps(day.id)}
          />
        ))}
      </div>

      <footer className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-frost-text-dim">
        <span>Frost // Week Tracker</span>
        <span>{loading ? 'Loading…' : signedIn ? 'Synced' : 'Local'}</span>
      </footer>

      <AccountDialog open={accountOpen} onClose={() => setAccountOpen(false)} email={email} />
    </div>
  );
}
