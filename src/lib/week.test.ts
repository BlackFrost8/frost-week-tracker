import { describe, expect, it } from 'vitest';
import type { Task, Week } from '../types';
import { createWeek, mergeWeeks } from './week';

const task = (id: string, label: string, done = false): Task => ({ id, label, done, groupId: null });

function weekWith(monday: Task[], extra: Partial<Week> = {}): Week {
  const week = createWeek('2026-11-02');
  return {
    ...week,
    ...extra,
    days: week.days.map((d) => (d.id === 'mon' ? { ...d, tasks: monday } : d)),
  };
}

describe('mergeWeeks', () => {
  it('returns the primary week itself when the other adds nothing', () => {
    const a = weekWith([task('1', 'gym')]);
    const b = weekWith([task('1', 'gym')]);
    expect(mergeWeeks(a, b)).toBe(a);
  });

  it('keeps tasks written on either side', () => {
    const local = weekWith([task('1', 'gym'), task('2', 'essay')]);
    const cloud = weekWith([task('1', 'gym'), task('3', 'call mum')]);
    const labels = mergeWeeks(local, cloud).days[0].tasks.map((t) => t.label);
    expect(labels).toEqual(['gym', 'essay', 'call mum']);
  });

  it('does not double a routine seeded under different ids on two devices', () => {
    const local = weekWith([task('a1', 'Read 10 pages')]);
    const cloud = weekWith([task('b1', 'read 10 pages ')]);
    expect(mergeWeeks(local, cloud).days[0].tasks).toHaveLength(1);
  });

  it('keeps a tick made on either side', () => {
    const local = weekWith([task('1', 'gym', false), task('2', 'read', true)]);
    const cloud = weekWith([task('1', 'gym', true), task('2', 'read', false)]);
    const merged = mergeWeeks(local, cloud).days[0].tasks;
    expect(merged.map((t) => t.done)).toEqual([true, true]);
  });

  it('fills an empty focus line from the other copy, and never overwrites one', () => {
    const local = weekWith([], { focus: '', reward: 'film' });
    const cloud = weekWith([], { focus: 'exams', reward: 'pizza' });
    const merged = mergeWeeks(local, cloud);
    expect(merged.focus).toBe('exams');
    expect(merged.reward).toBe('film');
  });
});
