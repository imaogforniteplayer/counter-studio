import { describe, expect, it } from 'vitest';
import type { Counter, HistoryEntry } from './types';
import { createCounter } from './counter';
import {
  addBucket,
  bucketize,
  comparePeriods,
  computeStreaks,
  dailyCounts,
  goalHistory,
  heatLevel,
  heatmap,
  rangeWindow,
  sessionsFrom,
  startOfDay,
  startOfMonth,
  startOfWeek,
  statsByCounter,
  summarize,
} from './stats';

let seq = 0;
function entry(at: number, delta: number, over: Partial<HistoryEntry> = {}): HistoryEntry {
  seq += 1;
  const prev = over.prev ?? 0;
  return {
    id: `e${seq}`,
    counterId: 'c1',
    at,
    prev,
    next: prev + delta,
    delta,
    kind: delta >= 0 ? 'inc' : 'dec',
    target: null,
    label: null,
    session: 's1',
    reverted: false,
    ...over,
  };
}

// Tuesday 10 November 2026, local time.
const NOW = new Date(2026, 10, 10, 15, 30).getTime();
const day = (offset: number, hour = 12) => {
  const d = new Date(2026, 10, 10 + offset, hour, 0, 0);
  return d.getTime();
};

describe('calendar helpers', () => {
  it('finds the start of day, week (Monday) and month', () => {
    expect(startOfDay(NOW)).toBe(new Date(2026, 10, 10).getTime());
    expect(startOfWeek(NOW)).toBe(new Date(2026, 10, 9).getTime());
    expect(startOfWeek(new Date(2026, 10, 8, 10).getTime())).toBe(new Date(2026, 10, 2).getTime()); // Sunday -> previous Monday
    expect(startOfMonth(NOW)).toBe(new Date(2026, 10, 1).getTime());
  });

  it('adds buckets across month ends', () => {
    expect(addBucket(new Date(2026, 0, 31).getTime(), 'day', 1)).toBe(new Date(2026, 1, 1).getTime());
    expect(addBucket(new Date(2026, 10, 10).getTime(), 'week', -1)).toBe(new Date(2026, 10, 3).getTime());
  });
});

describe('rangeWindow', () => {
  it('uses hourly buckets for today', () => {
    const w = rangeWindow('today', NOW);
    expect(w.bucket).toBe('hour');
    expect(w.from).toBe(startOfDay(NOW));
  });

  it('covers exactly seven days for 7d', () => {
    const w = rangeWindow('7d', NOW);
    expect(w.from).toBe(new Date(2026, 10, 4).getTime());
    expect(bucketize([], w)).toHaveLength(7);
  });

  it('covers 30 days and 12 months', () => {
    expect(bucketize([], rangeWindow('30d', NOW))).toHaveLength(30);
    const months = bucketize([], rangeWindow('12m', NOW));
    expect(months).toHaveLength(12);
    expect(months[months.length - 1].start).toBe(startOfMonth(NOW));
  });

  it('chooses a bucket size for all time from the span', () => {
    expect(rangeWindow('all', NOW, day(-10)).bucket).toBe('day');
    expect(rangeWindow('all', NOW, day(-120)).bucket).toBe('week');
    expect(rangeWindow('all', NOW, day(-700)).bucket).toBe('month');
  });
});

describe('summarize', () => {
  it('counts increments, decrements and amounts', () => {
    const list = [entry(day(0), 1), entry(day(0), 5), entry(day(0), -2, { prev: 6 })];
    const s = summarize(list);
    expect(s.increments).toBe(2);
    expect(s.decrements).toBe(1);
    expect(s.amountUp).toBe(6);
    expect(s.amountDown).toBe(2);
    expect(s.net).toBe(4);
    expect(s.activity).toBe(3);
  });

  it('tracks highest and lowest reached', () => {
    const list = [entry(day(0), 4), entry(day(0), -9, { prev: 4 }), entry(day(0), 20, { prev: -5 })];
    const s = summarize(list);
    expect(s.highest).toBe(15);
    expect(s.lowest).toBe(-5);
  });

  it('returns nulls with no data and uses extra values when given', () => {
    expect(summarize([]).highest).toBeNull();
    const s = summarize([], [3, 9]);
    expect(s.highest).toBe(9);
    expect(s.lowest).toBe(3);
  });

  it('keeps sets, resets and undos out of the increment totals', () => {
    const list = [
      entry(day(0), 10, { kind: 'set' }),
      entry(day(0), -10, { kind: 'reset', prev: 10 }),
      entry(day(0), 1, { kind: 'undo' }),
    ];
    const s = summarize(list);
    expect(s.increments).toBe(0);
    expect(s.decrements).toBe(0);
    expect(s.edits).toBe(3);
  });

  it('counts goal completions and active days', () => {
    const list = [
      entry(day(-1), 1),
      entry(day(0), 1),
      entry(day(0), 0, { kind: 'goal' }),
    ];
    const s = summarize(list);
    expect(s.goalCompletions).toBe(1);
    expect(s.activeDays).toBe(2);
  });
});

describe('bucketize', () => {
  it('places events into the right daily buckets', () => {
    const list = [entry(day(0), 1), entry(day(0), 1), entry(day(-2), -1), entry(day(-2), 3)];
    const pts = bucketize(list, rangeWindow('7d', NOW));
    expect(pts[pts.length - 1].increments).toBe(2);
    expect(pts[pts.length - 3].decrements).toBe(1);
    expect(pts[pts.length - 3].increments).toBe(1);
    expect(pts.reduce((a, p) => a + p.activity, 0)).toBe(4);
  });

  it('puts today\'s activity into hourly buckets', () => {
    const list = [entry(day(0, 9), 1), entry(day(0, 9), 1), entry(day(0, 13), 1)];
    const pts = bucketize(list, rangeWindow('today', NOW));
    expect(pts.find((p) => new Date(p.start).getHours() === 9)!.activity).toBe(2);
    expect(pts.find((p) => new Date(p.start).getHours() === 13)!.activity).toBe(1);
  });

  it('ignores entries outside the window and non-counting kinds', () => {
    const list = [entry(day(-40), 1), entry(day(0), 1, { kind: 'set' })];
    const pts = bucketize(list, rangeWindow('7d', NOW));
    expect(pts.reduce((a, p) => a + p.activity, 0)).toBe(0);
  });
});

describe('comparePeriods', () => {
  it('compares with the previous period of equal length', () => {
    const win = rangeWindow('7d', NOW);
    const list = [
      entry(day(0), 1),
      entry(day(-1), 1),
      entry(day(-2), 1),
      entry(day(-3), 1), // current: 4
      entry(day(-8), 1),
      entry(day(-9), 1), // previous: 2
    ];
    const c = comparePeriods(list, win);
    expect(c.current.activity).toBe(4);
    expect(c.previous.activity).toBe(2);
    expect(c.activityChange).toBe(100);
  });

  it('reports no change when both periods are empty and null when only the past was empty', () => {
    const win = rangeWindow('7d', NOW);
    expect(comparePeriods([], win).activityChange).toBe(0);
    expect(comparePeriods([entry(day(0), 1)], win).activityChange).toBeNull();
  });
});

describe('streaks', () => {
  it('has no streak without activity', () => {
    expect(computeStreaks([], NOW)).toEqual({ current: 0, longest: 0, activeToday: false });
  });

  it('counts consecutive days ending today', () => {
    const list = [entry(day(0), 1), entry(day(-1), 1), entry(day(-2), 1), entry(day(-5), 1)];
    const s = computeStreaks(list, NOW);
    expect(s.current).toBe(3);
    expect(s.longest).toBe(3);
    expect(s.activeToday).toBe(true);
  });

  it('keeps the streak alive until the end of the day when today is empty', () => {
    const list = [entry(day(-1), 1), entry(day(-2), 1)];
    const s = computeStreaks(list, NOW);
    expect(s.current).toBe(2);
    expect(s.activeToday).toBe(false);
  });

  it('breaks the streak after a missed day but remembers the longest', () => {
    const list = [entry(day(-3), 1), entry(day(-4), 1), entry(day(-5), 1), entry(day(-6), 1)];
    const s = computeStreaks(list, NOW);
    expect(s.current).toBe(0);
    expect(s.longest).toBe(4);
  });

  it('ignores goal markers and multiple events in one day', () => {
    const list = [entry(day(0), 1), entry(day(0), 1), entry(day(-1), 0, { kind: 'goal' })];
    expect(computeStreaks(list, NOW).current).toBe(1);
  });
});

describe('sessions, per-counter stats and goals', () => {
  it('groups entries by session', () => {
    const list = [
      entry(day(0, 9), 1, { session: 'a' }),
      entry(day(0, 10), 2, { session: 'a' }),
      entry(day(-1, 9), -1, { session: 'b', counterId: 'c2' }),
    ];
    const sessions = sessionsFrom(list);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe('a');
    expect(sessions[0].events).toBe(2);
    expect(sessions[0].net).toBe(3);
    expect(sessions[1].counters).toBe(1);
  });

  it('computes statistics per counter, busiest first', () => {
    const a: Counter = createCounter({ id: 'c1', name: 'A' });
    const b: Counter = createCounter({ id: 'c2', name: 'B' });
    const list = [entry(day(0), 1), entry(day(0), 1, { counterId: 'c2' }), entry(day(0), 1, { counterId: 'c2' })];
    const stats = statsByCounter(list, [a, b]);
    expect(stats[0].counter.id).toBe('c2');
    expect(stats[0].summary.activity).toBe(2);
    expect(stats[1].lastActivity).toBe(day(0));
  });

  it('lists goal completions newest first', () => {
    const list = [
      entry(day(-2), 0, { kind: 'goal' }),
      entry(day(0), 0, { kind: 'goal' }),
      entry(day(-1), 1),
    ];
    const g = goalHistory(list);
    expect(g).toHaveLength(2);
    expect(g[0].at).toBe(day(0));
  });

  it('builds a daily activity series', () => {
    const list = [entry(day(0), 1), entry(day(0), 1), entry(day(-1), 1)];
    const d = dailyCounts(list, 3, NOW);
    expect(d.map((x) => x.count)).toEqual([0, 1, 2]);
  });
});

describe('heatmap', () => {
  it('levels: quiet is 0 and the busiest day is 4', () => {
    expect(heatLevel(0, 8)).toBe(0);
    expect(heatLevel(1, 8)).toBe(1);
    expect(heatLevel(2, 8)).toBe(1);
    expect(heatLevel(3, 8)).toBe(2);
    expect(heatLevel(6, 8)).toBe(3);
    expect(heatLevel(8, 8)).toBe(4);
    expect(heatLevel(5, 0)).toBe(0);
    expect(heatLevel(-2, 8)).toBe(0);
  });

  it('lays out whole weeks, Monday first, ending with the current week', () => {
    const h = heatmap([], 4, NOW);
    expect(h.weeks).toHaveLength(4);
    h.weeks.forEach((w) => expect(w).toHaveLength(7));
    // NOW is a Tuesday, so the last week has Monday and Tuesday, then nothing.
    const last = h.weeks[3];
    expect(last[0]).not.toBeNull();
    expect(last[1]).not.toBeNull();
    expect(last.slice(2).every((c) => c === null)).toBe(true);
    expect(last[1]!.day).toBe(startOfDay(NOW));
    expect(new Date(h.weeks[0][0]!.day).getDay()).toBe(1);
  });

  it('counts only counting changes, per day', () => {
    const list = [
      entry(day(0), 1),
      entry(day(0), 1),
      entry(day(0), -1),
      entry(day(-1), 1),
      entry(day(0), 5, { kind: 'set' }),
      entry(day(0), 0, { kind: 'reset' }),
    ];
    const h = heatmap(list, 2, NOW);
    const cells = h.weeks.flat().filter((c) => c !== null);
    const today = cells.find((c) => c!.day === startOfDay(NOW))!;
    const yesterday = cells.find((c) => c!.day === startOfDay(day(-1)))!;
    expect(today.count).toBe(3);
    expect(today.level).toBe(4);
    expect(yesterday.count).toBe(1);
    expect(h.max).toBe(3);
    expect(h.total).toBe(4);
    expect(h.activeDays).toBe(2);
  });

  it('ignores activity older than the weeks shown', () => {
    const h = heatmap([entry(day(-200), 1)], 4, NOW);
    expect(h.total).toBe(0);
    expect(h.activeDays).toBe(0);
  });

  it('marks where each month begins, starting with the first column', () => {
    const h = heatmap([], 26, NOW);
    expect(h.monthStarts[0].week).toBe(0);
    const months = h.monthStarts.map((m) => m.month);
    expect(new Set(months).size).toBe(months.length);
    for (let i = 1; i < h.monthStarts.length; i++) expect(h.monthStarts[i].week).toBeGreaterThan(h.monthStarts[i - 1].week);
  });

  it('always shows at least one week', () => {
    expect(heatmap([], 0, NOW).weeks).toHaveLength(1);
  });
});
