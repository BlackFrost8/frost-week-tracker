import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cloud, setDoc, doc } from '../test/fakeFirestore';

vi.mock('firebase/firestore/lite', () => import('../test/fakeFirestore'));
vi.mock('./firebase', () => ({
  auth: { currentUser: { uid: 'u1' } },
  db: {},
  isCloudConfigured: true,
}));

const { loadPrefs, savePrefs, flushPrefs } = await import('./prefs');

const PATH = 'users/u1/settings/prefs';
const group = (id: string) => ({ id, name: id, icon: 'book', carryAcross: false });
const goal = (id: string, done = false) => ({ id, label: id, done });
const stored = () => cloud.docs.get(PATH) as Record<string, unknown> & { groups: { id: string }[]; goals: { id: string; done: boolean }[] };

/** Another device writing one field, the way `savePrefs` does. */
const otherDevice = (field: string, value: unknown, rev: string) =>
  setDoc(doc({}, ...PATH.split('/')), { [field]: value, stamps: { [field]: rev } }, { merge: true });

beforeEach(() => cloud.reset());

describe('prefs sync', () => {
  it("a stale tab editing goals doesn't erase a group another device added", async () => {
    cloud.docs.set(PATH, { groups: [group('g0')], goals: [goal('learn piano')] });
    const stale = await loadPrefs();

    await otherDevice('groups', [group('g0'), group('g1')], 'other-1');

    await savePrefs({ ...stale, goals: [goal('learn piano', true)] }, ['goals']);
    await flushPrefs();

    expect(stored().groups.map((g) => g.id)).toEqual(['g0', 'g1']);
    expect(stored().goals[0].done).toBe(true);
  });

  it('keeps an offline edit through the next reload instead of reverting to the cloud', async () => {
    cloud.docs.set(PATH, { groups: [group('g0')] });
    const loaded = await loadPrefs();

    cloud.offline = true;
    await expect(savePrefs({ ...loaded, groups: [group('g0'), group('g2')] }, ['groups'])).rejects.toThrow();

    cloud.offline = false;
    const reloaded = await loadPrefs();
    expect(reloaded.groups.map((g) => g.id)).toEqual(['g0', 'g2']);
    await flushPrefs();
    expect(stored().groups.map((g) => g.id)).toEqual(['g0', 'g2']);
  });

  it('merges when both devices changed the same field apart', async () => {
    cloud.docs.set(PATH, { goals: [goal('a')] });
    const loaded = await loadPrefs();

    cloud.offline = true;
    await expect(savePrefs({ ...loaded, goals: [goal('a'), goal('mine')] }, ['goals'])).rejects.toThrow();
    cloud.offline = false;
    await otherDevice('goals', [goal('a'), goal('theirs')], 'other-1');

    const reloaded = await loadPrefs();
    expect(reloaded.goals.map((g) => g.id)).toEqual(['a', 'mine', 'theirs']);
  });

  it('keeps a standing note made offline through the next reload', async () => {
    const note = { label: 'bring gym bag', days: ['mon' as const], groupId: 'g1' };
    cloud.docs.set(PATH, { goals: [goal('a')] });
    const loaded = await loadPrefs();

    cloud.offline = true;
    await expect(savePrefs({ ...loaded, defaultNotes: [note] }, ['defaultNotes'])).rejects.toThrow();

    cloud.offline = false;
    expect((await loadPrefs()).defaultNotes).toEqual([note]);
    await flushPrefs();
    expect(stored().defaultNotes).toEqual([note]);
  });

  it('adopts the cloud copy for fields with no unsent edit', async () => {
    cloud.docs.set(PATH, { goals: [goal('a')] });
    await loadPrefs();
    await otherDevice('goals', [goal('b')], 'other-1');
    expect((await loadPrefs()).goals.map((g) => g.id)).toEqual(['b']);
  });
});
