import {
  GoogleAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore/lite';
import { auth, db } from './firebase';
import { addDays, currentWeekStart, fromISODate, toISODate } from './week';

/**
 * Google Calendar, read-only.
 *
 * Events are imported rather than fetched live: the access token Google hands
 * a browser lasts an hour and comes with no refresh token, so a planner that
 * could only show events while holding one would go blank every hour. The
 * imported copy is saved to the account, which also puts the events on a
 * device whose browser blocks the Google popup.
 */

const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';
const API = 'https://www.googleapis.com/calendar/v3';

/** Two weeks back, twelve ahead. */
const WINDOW_BACK_DAYS = 14;
const WINDOW_AHEAD_DAYS = 84;
const MAX_EVENTS = 500;
const MAX_CALENDARS = 10;
const MAX_TITLE = 120;
/** A week-long conference shows on each day; a three-month block does not. */
const MAX_SPAN_DAYS = 14;

export type CalendarEvent = {
  /** Unique per day: a multi-day event is one entry per date it covers. */
  id: string;
  title: string;
  /** Local YYYY-MM-DD. */
  date: string;
  /** Local 24h "HH:MM", or null for an all-day event. */
  time: string | null;
};

export type CalendarImport = {
  connected: boolean;
  events: CalendarEvent[];
  /** ISO timestamp, or null before the first import. */
  importedAt: string | null;
};

export const EMPTY_IMPORT: CalendarImport = { connected: false, events: [], importedAt: null };

/** The token is gone or expired; a popup is the only way to get another. */
export class CalendarAuthError extends Error {}

/* ── Access token ──────────────────────────────────────────────────────────
   Held for the tab's lifetime only. It is a bearer credential for someone's
   calendar, so it never goes in localStorage on a shared Chromebook. */

const TOKEN_KEY = 'frost-week-tracker:gcal-token';
type HeldToken = { token: string; expires: number };

function readToken(): string | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const held = JSON.parse(raw) as HeldToken;
    return held.expires > Date.now() ? held.token : null;
  } catch {
    return null;
  }
}

function holdToken(token: string): void {
  try {
    // Google issues an hour; five minutes short so a fetch never starts on a dying one.
    const held: HeldToken = { token, expires: Date.now() + 55 * 60_000 };
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(held));
  } catch {
    /* Private mode: the token still works for this import. */
  }
}

export function forgetToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* Nothing was held. */
  }
}

export const heldToken = readToken;

/**
 * Opens Google's consent popup for read access to the calendar.
 *
 * Must be reached synchronously from a click, like every popup. A Google
 * account re-confirms itself; an email account has Google linked to it, which
 * also gives it Google sign-in from then on.
 */
export async function requestCalendarAccess(): Promise<string> {
  const user = auth?.currentUser;
  if (!user) throw new Error('Sign in first.');

  const provider = new GoogleAuthProvider();
  provider.addScope(SCOPE);

  let result: UserCredential;
  if (user.providerData.some((p) => p.providerId === 'google.com')) {
    if (user.email) provider.setCustomParameters({ login_hint: user.email });
    result = await reauthenticateWithPopup(user, provider);
  } else {
    result = await linkWithPopup(user, provider);
  }

  const token = GoogleAuthProvider.credentialFromResult(result)?.accessToken;
  if (!token) throw new Error('Google didn’t grant calendar access.');
  holdToken(token);
  return token;
}

/** Best effort. The grant also lapses on its own within the hour. */
export function revokeAccess(): void {
  const token = readToken();
  forgetToken();
  if (!token) return;
  void fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
    method: 'POST',
  }).catch(() => {});
}

/* ── Fetching ──────────────────────────────────────────────────────────── */

type ApiTime = { date?: string; dateTime?: string };
type ApiEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: ApiTime;
  end?: ApiTime;
  attendees?: { self?: boolean; responseStatus?: string }[];
};
type ApiCalendar = { id?: string; selected?: boolean; primary?: boolean };

async function api<T>(token: string, path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 401) {
    forgetToken();
    throw new CalendarAuthError('Google needs you to reconnect.');
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(body)) {
      throw new Error('Google Calendar isn’t switched on for this app yet.');
    }
    throw new Error(`Google Calendar answered ${res.status}.`);
  }
  return (await res.json()) as T;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** One entry per local date the event touches, within the cap. */
function toEvents(raw: ApiEvent, calendarId: string): CalendarEvent[] {
  if (!raw.id || raw.status === 'cancelled') return [];
  if (raw.attendees?.some((a) => a.self && a.responseStatus === 'declined')) return [];

  const title = (raw.summary ?? '').trim().slice(0, MAX_TITLE) || 'Busy';
  const id = `${calendarId}:${raw.id}`;

  if (raw.start?.dateTime) {
    const start = new Date(raw.start.dateTime);
    if (Number.isNaN(start.getTime())) return [];
    return [
      { id, title, date: toISODate(start), time: `${pad(start.getHours())}:${pad(start.getMinutes())}` },
    ];
  }

  const first = raw.start?.date;
  if (!first) return [];
  // An all-day end date is exclusive.
  const last = raw.end?.date ? addDays(raw.end.date, -1) : first;
  const out: CalendarEvent[] = [];
  for (let date = first; date <= last && out.length < MAX_SPAN_DAYS; date = addDays(date, 1)) {
    out.push({ id: `${id}:${date}`, title, date, time: null });
  }
  return out;
}

async function eventsFor(
  token: string,
  calendarId: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const out: CalendarEvent[] = [];
  let pageToken: string | undefined;
  // Three pages of 250 is past the import cap anyway.
  for (let page = 0; page < 3; page += 1) {
    const params = new URLSearchParams({
      singleEvents: 'true',
      orderBy: 'startTime',
      timeMin,
      timeMax,
      maxResults: '250',
    });
    if (pageToken) params.set('pageToken', pageToken);
    const res = await api<{ items?: ApiEvent[]; nextPageToken?: string }>(
      token,
      `/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
    );
    for (const item of res.items ?? []) out.push(...toEvents(item, calendarId));
    pageToken = res.nextPageToken;
    if (!pageToken) break;
  }
  return out;
}

/** Every calendar the person has ticked in Google Calendar, over the window. */
export async function fetchCalendarEvents(token: string): Promise<CalendarEvent[]> {
  const monday = currentWeekStart();
  const timeMin = fromISODate(addDays(monday, -WINDOW_BACK_DAYS)).toISOString();
  const timeMax = fromISODate(addDays(monday, WINDOW_AHEAD_DAYS)).toISOString();

  const list = await api<{ items?: ApiCalendar[] }>(
    token,
    '/users/me/calendarList?minAccessRole=reader',
  );
  const ids = (list.items ?? [])
    .filter((c) => c.id && (c.selected || c.primary))
    .slice(0, MAX_CALENDARS)
    .map((c) => c.id as string);

  const perCalendar = await Promise.all(
    ids.map((id) => eventsFor(token, id, timeMin, timeMax)),
  );

  const seen = new Set<string>();
  const events: CalendarEvent[] = [];
  for (const event of perCalendar.flat()) {
    if (seen.has(event.id)) continue;
    seen.add(event.id);
    events.push(event);
  }
  // All-day first, then by time; `null` sorts ahead of any "HH:MM".
  events.sort(
    (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''),
  );
  return events.slice(0, MAX_EVENTS);
}

/* ── Storage ───────────────────────────────────────────────────────────────
   Local first, mirrored to `users/{uid}/settings/calendar`. A separate
   document from prefs: an import rewrites hundreds of events, and prefs is
   written on every standing-task keystroke. */

const localKey = (uid: string) => `frost-week-tracker:calendar:${uid}`;
const calendarDoc = (uid: string) => doc(db!, 'users', uid, 'settings', 'calendar');

function toEvent(raw: unknown): CalendarEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Partial<CalendarEvent>;
  if (typeof r.id !== 'string' || typeof r.date !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return null;
  return {
    id: r.id,
    title: typeof r.title === 'string' ? r.title.slice(0, MAX_TITLE) : '',
    date: r.date,
    time: typeof r.time === 'string' && /^\d{2}:\d{2}$/.test(r.time) ? r.time : null,
  };
}

function normalise(raw: unknown): CalendarImport {
  if (typeof raw !== 'object' || raw === null) return EMPTY_IMPORT;
  const r = raw as Partial<CalendarImport>;
  const events = Array.isArray(r.events)
    ? r.events
        .map(toEvent)
        .filter((e): e is CalendarEvent => e !== null)
        .slice(0, MAX_EVENTS)
    : [];
  return {
    connected: r.connected === true,
    events,
    importedAt: typeof r.importedAt === 'string' ? r.importedAt : null,
  };
}

function readLocal(uid: string): CalendarImport {
  try {
    const raw = localStorage.getItem(localKey(uid));
    return raw ? normalise(JSON.parse(raw)) : EMPTY_IMPORT;
  } catch {
    return EMPTY_IMPORT;
  }
}

function writeLocal(uid: string, data: CalendarImport): void {
  try {
    localStorage.setItem(localKey(uid), JSON.stringify(data));
  } catch {
    /* Quota or private mode — the cloud copy still holds it. */
  }
}

export function clearLocalCalendar(uid: string): void {
  try {
    localStorage.removeItem(localKey(uid));
  } catch {
    /* Nothing stored. */
  }
}

/** Whichever copy was imported last. A network failure falls back to the device. */
export async function loadCalendar(uid: string): Promise<CalendarImport> {
  const local = readLocal(uid);
  if (!db) return local;
  try {
    const snap = await getDoc(calendarDoc(uid));
    if (!snap.exists()) return local;
    const cloud = normalise(snap.data());
    if ((cloud.importedAt ?? '') >= (local.importedAt ?? '')) {
      writeLocal(uid, cloud);
      return cloud;
    }
    return local;
  } catch {
    return local;
  }
}

export async function saveCalendar(uid: string, data: CalendarImport): Promise<void> {
  const clean = normalise(data);
  writeLocal(uid, clean);
  if (!db) return;
  await setDoc(calendarDoc(uid), clean);
}
