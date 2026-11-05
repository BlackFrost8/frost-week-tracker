import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Task, Week } from '../types';
import { cloud } from '../test/fakeFirestore';

vi.mock('firebase/firestore/lite', () => import('../test/fakeFirestore'));
vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  isCloudConfigured: true,
}));

const { cloudStore, flushPending, migrateLocalToCloud } = await import('./storage');
const { createWeek } = await import('./week');

const WEEK = '2026-11-02';
const weekPath = `users/u1/weeks/${WEEK}`;
const task = (id: string, label: string, done = false, groupId: string | null = null): Task => ({
  id,
  label,
  done,
  groupId,
});

function weekWith(monday: Task[]): Week {
  const week = createWeek(WEEK);
  return { ...week, days: week.days.map((d) => (d.id === 'mon' ? { ...d, tasks: monday } : d)) };
}

function cloudMonday(): Task[] {
  const data = cloud.docs.get(weekPath) as unknown as Week;
  return data.days.find((d) => d.id === 'mon')!.tasks;
}

const meta = () =>
  JSON.parse(localStorage.getItem('frost-week-tracker:mirror:u1:meta') ?? '{}')[WEEK];

beforeEach(() => cloud.reset());

describe('cloud sync', () => {
  it('lets an offline edit win when nobody else wrote, whatever the clocks say', async () => {
    // Another device, its clock far ahead, wrote the week.
    cloud.docs.set(weekPath, { ...weekWith([task('1', 'gym')]), updatedAt: '2099-01-01T00:00:00.000Z', rev: 'r1' });
    await cloudStore.loadWeek(WEEK);

    cloud.offline = true;
    await expect(cloudStore.saveWeek(weekWith([task('1', 'gym', true)]))).rejects.toThrow();
    expect(meta().dirty).toBe(true);

    cloud.offline = false;
    const loaded = await cloudStore.loadWeek(WEEK);
    expect(loaded!.days[0].tasks[0].done).toBe(true);
    expect(cloudMonday()[0].done).toBe(true);
    expect(meta().dirty).toBe(false);
  });

  it('merges instead of dropping a side when another device wrote meanwhile', async () => {
    cloud.docs.set(weekPath, { ...weekWith([task('1', 'gym')]), updatedAt: '2026-11-02T08:00:00.000Z', rev: 'r1' });
    await cloudStore.loadWeek(WEEK);

    cloud.offline = true;
    await expect(
      cloudStore.saveWeek(weekWith([task('1', 'gym', true), task('2', 'essay')])),
    ).rejects.toThrow();

    // The other device adds something while this one is offline.
    cloud.docs.set(weekPath, {
      ...weekWith([task('1', 'gym'), task('3', 'call mum')]),
      updatedAt: '2099-01-01T00:00:00.000Z',
      rev: 'r2',
    });

    cloud.offline = false;
    await flushPending();
    const tasks = cloudMonday();
    expect(tasks.map((t) => t.label)).toEqual(['gym', 'essay', 'call mum']);
    expect(tasks[0].done).toBe(true);
    expect(meta().dirty).toBe(false);
  });
});

describe('first sign-in migration', () => {
  it('adds signed-out tasks to a week the account already has', async () => {
    localStorage.setItem(
      'frost-week-tracker:v1',
      JSON.stringify({ [WEEK]: weekWith([task('a', 'typed signed out')]) }),
    );
    cloud.docs.set(weekPath, { ...weekWith([task('b', 'from the PC')]), updatedAt: '2026-11-01T00:00:00.000Z', rev: 'r1' });

    await migrateLocalToCloud();

    expect(cloudMonday().map((t) => t.label)).toEqual(['from the PC', 'typed signed out']);
    expect(localStorage.getItem('frost-week-tracker:v1')).toBeNull();
  });

  it('brings the signed-out groups along, so migrated tasks keep their marks', async () => {
    localStorage.setItem(
      'frost-week-tracker:v1',
      JSON.stringify({ [WEEK]: weekWith([task('a', 'revise', false, 'g-school')]) }),
    );
    localStorage.setItem(
      'frost-week-tracker:prefs',
      JSON.stringify({ groups: [{ id: 'g-school', name: 'School', icon: 'book' }], goals: [] }),
    );
    cloud.docs.set('users/u1/settings/prefs', {
      groups: [{ id: 'g-health', name: 'Health', icon: 'heart', carryAcross: false }],
    });

    await migrateLocalToCloud();
    const { flushPrefs } = await import('./prefs');
    await flushPrefs();

    const prefs = cloud.docs.get('users/u1/settings/prefs') as { groups: { id: string }[] };
    expect(prefs.groups.map((g) => g.id)).toEqual(['g-health', 'g-school']);
    expect(cloudMonday()[0].groupId).toBe('g-school');
    expect(localStorage.getItem('frost-week-tracker:prefs')).toBeNull();
  });

  it('leaves everything in place to retry when the account cannot be reached', async () => {
    localStorage.setItem(
      'frost-week-tracker:v1',
      JSON.stringify({ [WEEK]: weekWith([task('a', 'typed signed out')]) }),
    );
    cloud.offline = true;
    await expect(migrateLocalToCloud()).rejects.toThrow();
    expect(localStorage.getItem('frost-week-tracker:v1')).not.toBeNull();
    expect(localStorage.getItem('frost-week-tracker:migrated:u1')).toBeNull();
  });
});
