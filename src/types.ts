export type Task = {
  id: string;
  label: string;
  done: boolean;
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
