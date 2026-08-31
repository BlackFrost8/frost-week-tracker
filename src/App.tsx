import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DayId } from './types';
import type { IconId } from './lib/icons';
import { MAX_GROUPS, groupById, makeGroup, type StandingTask, type TaskGroup } from './lib/prefs';
import { useAuth, signOut } from './hooks/useAuth';
import { useClickRipple } from './hooks/useClickRipple';
import { usePrefs } from './hooks/usePrefs';
import { useTheme } from './hooks/useTheme';
import { useWeek, type StandingGroupChange } from './hooks/useWeek';
import {
  cloudStore,
  clearAccountCache,
  flushPending,
  localStore,
  migrateLocalToCloud,
} from './lib/storage';
import { clearLocalPrefs, flushPrefs } from './lib/prefs';
import { DAY_IDS, completedCount, groupTotals, weekOverallPct, weekTotals } from './lib/week';
import { useToday } from './hooks/useToday';
import { paintFavicon } from './lib/favicon';
import { AmbientBackground } from './components/AmbientBackground';
import { Header } from './components/Header';
import { IntentPanel } from './components/IntentPanel';
import { HeroPanel } from './components/HeroPanel';
import { PaceCurve } from './components/PaceCurve';
import { WeekStrip } from './components/WeekStrip';
import { DayCard, type Suggestion } from './components/DayCard';
import { GroupPanel } from './components/GroupPanel';
import { AccountDialog } from './components/AccountDialog';
import { GroupDialog } from './components/GroupDialog';
import { InfoDialog } from './components/InfoDialog';
import { SettingsButton } from './components/SettingsButton';
import { ThemeDialog } from './components/ThemeDialog';

export default function App() {
  useClickRipple();

  // Lifted out of ThemeDialog: the header's wordmark renders the theme's
  // name, so both need the same instance of that state.
  const theme = useTheme();

  const { mode, profile, refresh: refreshAccount } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [migratedUid, setMigratedUid] = useState<string | null>(null);

  /**
   * What the group dialog is currently for.
   *
   * `assignTo` is the whole reason this is a shape rather than a boolean: the
   * dialog is reachable from the picker on a task row, and a group made from
   * there has to end up holding that task. Without it, making a group mid-flow
   * meant creating it, closing the dialog, reopening the picker and choosing
   * the thing you had just made — three steps to finish one.
   */
  const [groupEdit, setGroupEdit] = useState<
    | { mode: 'new'; assignTo: { dayId: DayId; taskId: string } | null }
    | { mode: 'edit'; group: TaskGroup }
    | null
  >(null);

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
    previousWeek,
    weekStart,
    knownWeeks,
    sync,
    error,
    loadError,
    retry,
    goToWeek,
    toggleTask,
    setTaskLabel,
    addTask,
    addTasks,
    removeTask,
    setTaskGroup,
    setMeta,
    clearChecks,
    applyStandingTasks,
    applyStandingGroups,
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
  const saveGroups = useCallback(
    (groups: TaskGroup[]) => void updatePrefs({ groups }),
    [updatePrefs],
  );

  /* Stable, because the dialogs manage focus and a changing handler identity
     is a reason to re-run that. `useDialog` no longer depends on these, so
     this is belt-and-braces rather than the fix — but an inline arrow here is
     precisely what made the theme-name box unusable, and there is no reason
     to leave the trap armed for the next effect that needs one of these. */
  const closeAccount = useCallback(() => setAccountOpen(false), []);
  const openTheme = useCallback(() => setThemeOpen(true), []);
  const closeTheme = useCallback(() => setThemeOpen(false), []);
  const closeGroupEdit = useCallback(() => setGroupEdit(null), []);

  const openEditGroup = useCallback(
    (group: TaskGroup) => setGroupEdit({ mode: 'edit', group }),
    [],
  );

  /* The cap is enforced here rather than by letting the save fall on the floor:
     `normalise` slices the stored list, so a thirteenth group would be built,
     briefly assigned to a task, and then silently vanish on the next load. */
  const canAddGroup = prefs.groups.length < MAX_GROUPS;

  // Not `todayISO()` during render: that is right only until midnight, and a
  // tab left focused overnight never re-rendered to notice. See useToday.
  const today = useToday();
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

  /**
   * Changing a standing task's group re-files the tasks already on the board.
   *
   * Standing tasks are seeded only when a week is *created*, so before this the
   * mark you had just chosen reached next week and nothing you could see. The
   * reconcile itself lives in `useWeek`; what lives here is *which* standing
   * tasks changed, and what they changed from.
   *
   * Only the entries whose group actually moved in this edit are passed on.
   * Handing over the whole list instead would make every edit re-file every
   * matching task — so taking one task out of a group by hand held until you
   * next touched an unrelated standing task, and then silently undid itself.
   * Diffing means a change to "water" cannot disturb "strength training".
   *
   * Both directions travel. Clearing a standing task's group used to be
   * dropped here on the grounds that a sweep must never overrule you, which
   * meant choosing "no group" left every instance on the week still wearing
   * the old mark and nothing to remove it with but seven visits to seven
   * days. The previous group goes along with the new one instead, so the
   * reconcile can leave alone anything you had moved elsewhere yourself.
   *
   * The first map seen is recorded without being applied. Prefs arrive
   * asynchronously, so every load starts as `[]` and then becomes the real
   * list — reading that as an edit would re-file on every single refresh.
   */
  const standingGroupMap = useMemo(() => {
    const byLabel: Record<string, string | null> = {};
    for (const task of prefs.defaultTasks) {
      const key = task.label.trim().toLowerCase();
      if (key) byLabel[key] = task.groupId;
    }
    return byLabel;
  }, [prefs.defaultTasks]);

  const appliedStanding = useRef<Record<string, string | null> | null>(null);

  useEffect(() => {
    if (!ready || !weekLoaded) {
      /* Forget the baseline rather than keep it. The next list to arrive
         belongs to a different session — signing in, signing out — and its
         groups are a different account's ids entirely, so diffing the two
         would file this week's tasks into groups that were never ours. A
         fresh sighting is the honest reading of it. */
      appliedStanding.current = null;
      return;
    }
    const previous = appliedStanding.current;
    appliedStanding.current = standingGroupMap;
    if (previous === null) return;

    const changed: StandingGroupChange[] = [];
    for (const task of prefs.defaultTasks) {
      const label = task.label.trim().toLowerCase();
      if (!label) continue;
      // A label that wasn't in the list before reads as "was in no group",
      // which is what a newly typed standing task in fact was.
      const from = previous[label] ?? null;
      if (from === task.groupId) continue;
      changed.push({ label, from, to: task.groupId });
    }
    if (changed.length > 0) applyStandingGroups(changed);
  }, [ready, weekLoaded, standingGroupMap, applyStandingGroups, prefs.defaultTasks]);

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

  /**
   * Everything this account left on this device goes with it.
   *
   * Nothing used to be removed at all, so the mirrored weeks, their focus and
   * reward and affirmation lines, the standing tasks and the profile photo all
   * stayed readable in devtools by whoever sat down next. On a shared school
   * Chromebook that is the realistic exposure, and the uid scoping never
   * addressed it — it keeps one account's data off the *screen*, which is not
   * the same as it being gone.
   *
   * Order is load-bearing. Every write path reads `auth.currentUser`, so all
   * three flushes have to happen while the session still exists; and each
   * clear is refused unless its flush confirmed the cloud has the work, since
   * the device copy is the only other copy. Work that could not be uploaded is
   * therefore deliberately left behind rather than destroyed to tidy up.
   */
  const handleSignOut = async () => {
    const leaving = uid;

    await flush();
    await flushPending().catch(() => 0);
    const prefsSaved = await flushPrefs().then(
      () => true,
      () => false,
    );

    await signOut();

    if (leaving) {
      clearAccountCache(leaving);
      if (prefsSaved) clearLocalPrefs(leaving);
    }
  };

  /* A week that could not be fetched is not a week with nothing in it. Saying
     so plainly matters more here than anywhere else in the app: the blank
     week this used to render was the exact picture of the thing the user is
     most afraid of. The reassurance is also true — nothing is deleted on a
     failed read, and the week is still in the account. */
  if (!week && loadError) {
    return (
      <>
        <AmbientBackground />
        <div className="relative z-10 grid frost-min-screen place-items-center px-6">
          <div className="flex max-w-sm flex-col items-center gap-5 text-center" role="alert">
            <p className="text-lg text-frost-text">This week didn’t load.</p>
            <p className="text-sm text-frost-text-dim">
              Nothing has been lost — it’s still saved. This is usually the
              connection.
            </p>
            <button
              type="button"
              onClick={retry}
              className="min-h-11 rounded-lg px-5 py-2.5 text-sm transition-colors duration-150"
              style={{
                backgroundColor: 'var(--color-frost-cyan-200)',
                color: 'var(--frost-on-accent)',
              }}
            >
              try again
            </button>
            <p className="font-mono text-xs text-frost-text-dim">{loadError}</p>
          </div>
        </div>
      </>
    );
  }

  if (!week) {
    return (
      <>
        <AmbientBackground />
        <div className="relative z-10 grid frost-min-screen place-items-center">
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

  /* Last week's score, or null when there is nothing honest to say — no
     previous week at all, or one that was never planned. A week is only
     persisted once it is edited, so "no previous week" is common and normal. */
  const previousPct =
    previousWeek && weekTotals(previousWeek).total > 0 ? weekOverallPct(previousWeek) : null;

  /* What this weekday held last week, minus whatever is already on it this
     week — so the list shrinks as you use it and disappears once you've taken
     everything worth taking. Capped at six: past that it stops being a nudge
     and becomes a second list to read. */
  const lastWeekDay = previousWeek?.days.find((d) => d.id === selectedDay.id) ?? null;
  const alreadyHere = new Set(selectedDay.tasks.map((t) => t.label.trim().toLowerCase()));
  const offered = new Set<string>();
  const suggestions: Suggestion[] = [];
  for (const task of lastWeekDay?.tasks ?? []) {
    if (suggestions.length === 6) break;
    const label = task.label.trim();
    const key = label.toLowerCase();
    // Deduped as well as filtered: two identical lines last Monday would
    // otherwise offer the same words twice, under the same React key.
    if (!label || alreadyHere.has(key) || offered.has(key)) continue;
    offered.add(key);
    /* Resolved rather than copied. A task from last week can point at a group
       that has since been deleted, and an offer carrying a dead id would land
       as a task nothing can show and nothing can find. */
    suggestions.push({ label, groupId: groupById(prefs.groups, task.groupId)?.id ?? null });
  }

  const handlers = {
    onToggle: (taskId: string) => toggleTask(selectedDay.id, taskId),
    onLabelChange: (taskId: string, label: string) =>
      setTaskLabel(selectedDay.id, taskId, label),
    onDelete: (taskId: string) => removeTask(selectedDay.id, taskId),
    onAdd: () => addTask(selectedDay.id),
    groups: prefs.groups,
    onGroupChange: (taskId: string, groupId: string | null) =>
      setTaskGroup(selectedDay.id, taskId, groupId),
    // Undefined at the cap, which is how the picker knows to stop offering it.
    onRequestNewGroup: canAddGroup
      ? (taskId: string) =>
          setGroupEdit({ mode: 'new', assignTo: { dayId: selectedDay.id, taskId } })
      : undefined,
    suggestions,
    onUseSuggestion: (s: Suggestion) => void addTask(selectedDay.id, s.label, s.groupId),
    onUseAllSuggestions: (items: Suggestion[]) => addTasks(selectedDay.id, items),
  };

  const saveGroup = (name: string, icon: IconId) => {
    if (!groupEdit) return;
    if (groupEdit.mode === 'edit') {
      // Renaming or re-marking a group changes nothing about the tasks: they
      // hold its id, never its name, so every week it has ever touched follows.
      saveGroups(
        prefs.groups.map((g) => (g.id === groupEdit.group.id ? { ...g, name, icon } : g)),
      );
      return;
    }
    if (!canAddGroup) return;
    const group = makeGroup(name, icon);
    saveGroups([...prefs.groups, group]);
    if (groupEdit.assignTo) {
      setTaskGroup(groupEdit.assignTo.dayId, groupEdit.assignTo.taskId, group.id);
    }
  };

  /* Nothing cascades into the weeks. A task pointing at a group that is gone
     resolves to null on read (`groupById`), on every device, including the ones
     that were offline when it went — which is both cheaper and more correct
     than rewriting every stored week to strip an id. */
  const deleteGroup = () => {
    if (groupEdit?.mode !== 'edit') return;
    saveGroups(prefs.groups.filter((g) => g.id !== groupEdit.group.id));
  };

  return (
    <>
      <AmbientBackground />

      {/* 1152px was capping the shell on every desktop, so a 1440p monitor spent
          55% of its width on empty black. The strip below is what earns the extra
          width — no text measure grows. */}
      <div className="frost-shell relative z-10 flex frost-min-screen flex-col gap-16 sm:gap-24">
        <Header
          weekStart={weekStart}
          knownWeeks={knownWeeks}
          onGoToWeek={goToWeek}
          sync={sync}
          profile={profile}
          avatar={prefs.avatar}
          onOpenAccount={() => setAccountOpen(true)}
          onOpenTheme={openTheme}
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
            {/* THE DAY CARD IS FIRST, and that is a phone decision.
                Below `md` this grid is one column, so source order is what the
                reader gets — and the reader is usually standing between two
                lessons with thirty seconds. The card used to sit behind a
                260px ring, which put the first checkbox at y=752: fine in a
                notional 812px viewport, below the fold in the ~660px a real
                mobile browser leaves once its chrome is counted. The most
                frequent interaction in the app opened onto a screen with
                nothing tappable on it.

                Nothing moves on a larger screen. Every child here is placed
                explicitly from `md` upward, so the desktop layout is set by
                the col-start/row-start pairs and not by this order at all.

                Capped and centred rather than filling its column: extra width
                becomes symmetric gutter instead of a hole to the right of a
                490px text measure. */}
            <div className="mx-auto w-full max-w-[660px] md:col-start-1 md:row-start-1 md:row-span-3 xl:col-start-2 xl:row-start-1 xl:row-span-2">
              <DayCard
                day={selectedDay}
                isToday={selectedDay.date === today}
                {...handlers}
              />
            </div>

            {/* Read-only, so their placement can vary across breakpoints without
                ever disagreeing with keyboard order. The curve is a separate
                grid item so that on a phone it falls below the card — stacked
                with the hero it pushed the day's tasks ~230px further down. */}
            <div className="flex flex-col gap-6 md:col-start-2 md:row-start-1 xl:col-start-1 xl:row-start-1">
              <HeroPanel week={week} previousPct={previousPct} />
              {todayDay && (
                <p className="text-center font-mono text-sm text-frost-text-dim">
                  <span className="text-frost-cyan-200">+{doneToday}</span> today
                </p>
              )}
            </div>

            <div className="md:col-start-2 md:row-start-2 xl:col-start-1 xl:row-start-2">
              <PaceCurve week={week} today={today} />
            </div>

            {/* One column, two blocks, 48px apart — the block-to-block step
                from the spacing cadence (§6). Groups sit under the week's
                intentions because both answer "what is this week for", at
                different resolutions: the three lines say why, the groups say
                where the work went. */}
            <div className="flex flex-col gap-12 md:col-start-2 md:row-start-3 xl:col-start-3 xl:row-start-1">
              <IntentPanel week={week} onSave={setMeta} onClearChecks={clearChecks} />
              <GroupPanel
                week={week}
                groups={prefs.groups}
                selected={selected}
                onSelectDay={setSelected}
                onNewGroup={
                  canAddGroup ? () => setGroupEdit({ mode: 'new', assignTo: null }) : undefined
                }
                onEditGroup={openEditGroup}
              />
            </div>
          </main>
        </div>
      </div>

      <AccountDialog
        open={accountOpen}
        onClose={closeAccount}
        profile={profile}
        onSignOut={handleSignOut}
        defaultTasks={prefs.defaultTasks}
        onSaveDefaultTasks={saveDefaultTasks}
        onApplyToWeek={applyStandingTasks}
        groups={prefs.groups}
        avatar={prefs.avatar}
        onSaveAvatar={saveAvatar}
        onAccountChanged={refreshAccount}
      />

      <ThemeDialog open={themeOpen} onClose={closeTheme} theme={theme} />

      {/* One instance for making and for editing. It reads its subject from
          `groupEdit` on open, so the two flows cannot drift apart. */}
      <GroupDialog
        open={groupEdit !== null}
        group={groupEdit?.mode === 'edit' ? groupEdit.group : null}
        onClose={closeGroupEdit}
        onSave={saveGroup}
        onDelete={groupEdit?.mode === 'edit' ? deleteGroup : undefined}
        taskCount={
          groupEdit?.mode === 'edit' ? groupTotals(week, groupEdit.group.id).total : 0
        }
      />

      {/* Owns its own open state — nothing else in the app needs to know, and
          the button is part of the feature rather than a separate control. */}
      <InfoDialog />

      {/* The phone half of the settings control. Below `sm` the header stacks
          and centres, which is no place for a control reached for
          occasionally, so it moves to the corner opposite the info button. Its
          twin in the header hides at the same breakpoint this one appears, so
          only ever one is on screen. */}
      <SettingsButton variant="floating" onClick={openTheme} />
    </>
  );
}
