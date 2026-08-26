export type Task = {
  id: string;
  label: string;
  done: boolean;
  /**
   * The group this task belongs to, or null. Points at a `TaskGroup.id` in the
   * account's prefs — groups outlive any one week, so they can't live in the
   * week document, and a task carrying the group's name or icon inline would
   * mean renaming "School" had to rewrite every week you ever wrote.
   *
   * `null` rather than optional on purpose: these objects are written straight
   * into a Firestore document, and `setDoc` rejects `undefined` outright. An
   * unassigned task must therefore carry an explicit null, not a missing key.
   * A pointer at a group that has since been deleted simply renders as
   * ungrouped — see `groupById` in `lib/prefs.ts`.
   */
  groupId: string | null;
};

export type Day = {
  id: DayId;
  label: string;
  /** ISO date (YYYY-MM-DD) of this specific day. Display formatting is derived. */
  date: string;
  tasks: Task[];
};

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type Week = {
  /** ISO date (YYYY-MM-DD) of the Monday that starts this week. Primary key. */
  weekStart: string;
  focus: string;
  reward: string;
  affirmation: string;
  days: Day[];
};

/** Where the current session's data lives. */
export type StorageKind = 'local' | 'cloud';

export type SyncState = 'idle' | 'saving' | 'saved' | 'error';
