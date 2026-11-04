import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarAuthError,
  EMPTY_IMPORT,
  fetchCalendarEvents,
  heldToken,
  loadCalendar,
  requestCalendarAccess,
  revokeAccess,
  saveCalendar,
  type CalendarEvent,
  type CalendarImport,
} from '../lib/gcal';

/** An import this recent is not redone on load. */
const FRESH_MS = 15 * 60_000;

export type CalendarStatus = 'idle' | 'importing' | 'error';

/** Errors a person caused on purpose are not worth reporting. */
function friendly(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return null;
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google popup.';
    case 'auth/user-mismatch':
      return 'Pick the Google account you signed in with.';
    case 'auth/credential-already-in-use':
      return 'That Google account belongs to a different sign-in.';
    case 'auth/network-request-failed':
      return 'No connection.';
    default:
      return err instanceof Error ? err.message : 'Couldn’t reach Google Calendar.';
  }
}

/**
 * The imported Google Calendar events for the signed-in account.
 *
 * `ready` waits for the same gate weeks do, so an import never lands under
 * an account that is still being migrated into.
 */
export function useCalendar(uid: string | null, ready: boolean) {
  const [data, setData] = useState<CalendarImport>(EMPTY_IMPORT);
  const [status, setStatus] = useState<CalendarStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  /* Bumped by every import and disconnect, so a load that started before one
     cannot land over it. */
  const seq = useRef(0);
  const uidRef = useRef(uid);
  uidRef.current = uid;

  const importWith = useCallback(async (token: string) => {
    const owner = uidRef.current;
    if (!owner) return;
    const mine = ++seq.current;
    setStatus('importing');
    setError(null);
    try {
      const events = await fetchCalendarEvents(token);
      const next: CalendarImport = { connected: true, events, importedAt: new Date().toISOString() };
      if (seq.current !== mine || uidRef.current !== owner) return;
      setData(next);
      setStatus('idle');
      await saveCalendar(owner, next).catch(() => {});
    } catch (err) {
      if (seq.current !== mine) return;
      setStatus(err instanceof CalendarAuthError ? 'idle' : 'error');
      setError(err instanceof CalendarAuthError ? null : friendly(err));
    }
  }, []);

  useEffect(() => {
    setData(EMPTY_IMPORT);
    setStatus('idle');
    setError(null);
    if (!ready || !uid) return;

    const mine = ++seq.current;
    void loadCalendar(uid).then((loaded) => {
      if (seq.current !== mine) return;
      setData(loaded);
      // Refreshed quietly only while this tab still holds a token: without
      // one it would take a popup, and a popup needs a click.
      const token = heldToken();
      const age = loaded.importedAt ? Date.now() - Date.parse(loaded.importedAt) : Infinity;
      if (loaded.connected && token && age > FRESH_MS) void importWith(token);
    });
  }, [uid, ready, importWith]);

  /** From a click: the popup must open before anything is awaited. */
  const connect = useCallback(() => {
    setError(null);
    requestCalendarAccess()
      .then(importWith)
      .catch((err: unknown) => {
        setStatus('idle');
        setError(friendly(err));
      });
  }, [importWith]);

  /** From a click. Reuses the tab's token, and asks Google again without one. */
  const refresh = useCallback(() => {
    const token = heldToken();
    if (token) void importWith(token);
    else connect();
  }, [connect, importWith]);

  const disconnect = useCallback(() => {
    const owner = uidRef.current;
    seq.current += 1;
    revokeAccess();
    const next: CalendarImport = { ...EMPTY_IMPORT, importedAt: new Date().toISOString() };
    setData(next);
    setStatus('idle');
    setError(null);
    if (owner) void saveCalendar(owner, next).catch(() => {});
  }, []);

  const byDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of data.events) {
      const list = map.get(event.date);
      if (list) list.push(event);
      else map.set(event.date, [event]);
    }
    return map;
  }, [data.events]);

  return {
    connected: data.connected,
    events: data.events,
    importedAt: data.importedAt,
    byDate,
    status,
    error,
    connect,
    refresh,
    disconnect,
  };
}

export type Calendar = ReturnType<typeof useCalendar>;
