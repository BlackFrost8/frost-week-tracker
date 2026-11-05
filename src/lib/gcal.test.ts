import { describe, expect, it, vi } from 'vitest';

vi.mock('./firebase', () => ({ auth: null, db: null, isCloudConfigured: false }));

const { toEvents } = await import('./gcal');

describe('toEvents', () => {
  it('carries a timed event across every day it runs into', () => {
    const events = toEvents(
      {
        id: 'trip',
        summary: 'Trip',
        start: { dateTime: '2026-11-06T22:00:00' },
        end: { dateTime: '2026-11-08T10:00:00' },
      },
      'primary',
    );
    expect(events.map((e) => [e.date, e.time, e.ongoing])).toEqual([
      ['2026-11-06', '22:00', false],
      ['2026-11-07', null, true],
      ['2026-11-08', null, true],
    ]);
    expect(new Set(events.map((e) => e.id)).size).toBe(3);
  });

  it('does not spill onto the next day for an event ending at midnight', () => {
    const events = toEvents(
      {
        id: 'party',
        start: { dateTime: '2026-11-06T20:00:00' },
        end: { dateTime: '2026-11-07T00:00:00' },
      },
      'primary',
    );
    expect(events).toHaveLength(1);
  });

  it('still treats an all-day end date as exclusive', () => {
    const events = toEvents(
      { id: 'conf', start: { date: '2026-11-02' }, end: { date: '2026-11-04' } },
      'primary',
    );
    expect(events.map((e) => e.date)).toEqual(['2026-11-02', '2026-11-03']);
  });
});
