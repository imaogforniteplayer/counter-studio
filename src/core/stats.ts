import type { Counter, HistoryEntry } from './types';
import { dayKey } from './format';

export type RangeKey = 'today' | '7d' | '30d' | '90d' | '12m' | 'all';
export type Bucket = 'hour' | 'day' | 'week' | 'month';

export const RANGES: { id: RangeKey; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
  { id: '12m', label: '12 months' },
  { id: 'all', label: 'All time' },
];

export interface TimeWindow {
  from: number;
  to: number;
  bucket: Bucket;
}

/* ---------- calendar helpers (local time) ---------- */

export function startOfHour(ts: number): number {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Weeks start on Monday. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

export function startOfMonth(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function addBucket(ts: number, bucket: Bucket, n = 1): number {
  const d = new Date(ts);
  switch (bucket) {
    case 'hour':
      d.setHours(d.getHours() + n);
      break;
    case 'day':
      d.setDate(d.getDate() + n);
      break;
    case 'week':
      d.setDate(d.getDate() + 7 * n);
      break;
    case 'month':
      d.setMonth(d.getMonth() + n);
      break;
  }
  return d.getTime();
}

export function bucketStart(ts: number, bucket: Bucket): number {
  switch (bucket) {
    case 'hour':
      return startOfHour(ts);
    case 'day':
      return startOfDay(ts);
    case 'week':
      return startOfWeek(ts);
    case 'month':
      return startOfMonth(ts);
  }
}

export function bucketLabel(ts: number, bucket: Bucket): string {
  const d = new Date(ts);
  switch (bucket) {
    case 'hour':
      return d.toLocaleTimeString(undefined, { hour: 'numeric' });
    case 'day':
      return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    case 'week':
      return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    case 'month':
      return d.toLocaleDateString(undefined, { month: 'short' });
  }
}

/** The time window and bucket size for a range. `earliest` is used by "all time". */
export function rangeWindow(range: RangeKey, now: number, earliest?: number): TimeWindow {
  const today = startOfDay(now);
  switch (range) {
    case 'today':
      return { from: today, to: now, bucket: 'hour' };
    case '7d':
      return { from: addBucket(today, 'day', -6), to: now, bucket: 'day' };
    case '30d':
      return { from: addBucket(today, 'day', -29), to: now, bucket: 'day' };
    case '90d':
      return { from: startOfWeek(addBucket(today, 'day', -89)), to: now, bucket: 'week' };
    case '12m':
      return { from: addBucket(startOfMonth(now), 'month', -11), to: now, bucket: 'month' };
    case 'all': {
      const from = startOfDay(earliest ?? addBucket(today, 'day', -29));
      const days = Math.max(1, Math.round((now - from) / 86_400_000));
      const bucket: Bucket = days <= 45 ? 'day' : days <= 220 ? 'week' : 'month';
      return { from: bucketStart(from, bucket), to: now, bucket };
    }
  }
}

export function inWindow(entries: HistoryEntry[], win: TimeWindow): HistoryEntry[] {
  return entries.filter((e) => e.at >= win.from && e.at <= win.to);
}

/* ---------- summaries ---------- */

export interface Summary {
  increments: number;
  decrements: number;
  amountUp: number;
  amountDown: number;
  net: number;
  /** Manual sets, resets and undos. */
  edits: number;
  /** increments + decrements */
  activity: number;
  goalCompletions: number;
  highest: number | null;
  lowest: number | null;
  activeDays: number;
}

export function summarize(entries: HistoryEntry[], extraValues: number[] = []): Summary {
  let increments = 0;
  let decrements = 0;
  let amountUp = 0;
  let amountDown = 0;
  let edits = 0;
  let goalCompletions = 0;
  let highest: number | null = null;
  let lowest: number | null = null;
  const days = new Set<string>();

  const see = (v: number) => {
    if (highest === null || v > highest) highest = v;
    if (lowest === null || v < lowest) lowest = v;
  };

  for (const e of entries) {
    if (e.kind === 'goal') {
      goalCompletions += 1;
      continue;
    }
    days.add(dayKey(e.at));
    see(e.prev);
    see(e.next);
    if (e.kind === 'inc' || e.kind === 'dec' || e.kind === 'auto') {
      if (e.delta > 0) {
        increments += 1;
        amountUp += e.delta;
      } else if (e.delta < 0) {
        decrements += 1;
        amountDown += -e.delta;
      }
    } else {
      edits += 1;
    }
  }
  for (const v of extraValues) see(v);

  return {
    increments,
    decrements,
    amountUp,
    amountDown,
    net: amountUp - amountDown,
    edits,
    activity: increments + decrements,
    goalCompletions,
    highest,
    lowest,
    activeDays: days.size,
  };
}

export interface BucketPoint {
  start: number;
  label: string;
  increments: number;
  decrements: number;
  activity: number;
}

export function bucketize(entries: HistoryEntry[], win: TimeWindow): BucketPoint[] {
  const points: BucketPoint[] = [];
  const index = new Map<number, BucketPoint>();
  let cursor = bucketStart(win.from, win.bucket);
  let guard = 0;
  while (cursor <= win.to && guard < 1000) {
    const p: BucketPoint = {
      start: cursor,
      label: bucketLabel(cursor, win.bucket),
      increments: 0,
      decrements: 0,
      activity: 0,
    };
    points.push(p);
    index.set(cursor, p);
    cursor = addBucket(cursor, win.bucket, 1);
    guard += 1;
  }
  for (const e of entries) {
    if (e.at < win.from || e.at > win.to) continue;
    if (e.kind !== 'inc' && e.kind !== 'dec' && e.kind !== 'auto') continue;
    const p = index.get(bucketStart(e.at, win.bucket));
    if (!p) continue;
    if (e.delta > 0) p.increments += 1;
    else if (e.delta < 0) p.decrements += 1;
    p.activity = p.increments + p.decrements;
  }
  return points;
}

export interface Comparison {
  current: Summary;
  previous: Summary;
  /** Percentage change in activity, or null when there is nothing to compare to. */
  activityChange: number | null;
  previousWindow: TimeWindow;
}

/** Compare a window with the equally long window immediately before it. */
export function comparePeriods(entries: HistoryEntry[], win: TimeWindow): Comparison {
  const length = win.to - win.from;
  const previousWindow: TimeWindow = { from: win.from - length, to: win.from - 1, bucket: win.bucket };
  const current = summarize(inWindow(entries, win));
  const previous = summarize(inWindow(entries, previousWindow));
  let activityChange: number | null = null;
  if (previous.activity > 0) {
    activityChange = ((current.activity - previous.activity) / previous.activity) * 100;
  } else if (current.activity === 0) {
    activityChange = 0;
  }
  return { current, previous, activityChange, previousWindow };
}

/** Activity per calendar day for the last `days` days, oldest first. */
export function dailyCounts(entries: HistoryEntry[], days: number, now: number): { day: number; count: number }[] {
  const today = startOfDay(now);
  const out: { day: number; count: number }[] = [];
  const index = new Map<string, { day: number; count: number }>();
  for (let i = days - 1; i >= 0; i--) {
    const day = addBucket(today, 'day', -i);
    const item = { day, count: 0 };
    out.push(item);
    index.set(dayKey(day), item);
  }
  for (const e of entries) {
    if (e.kind !== 'inc' && e.kind !== 'dec' && e.kind !== 'auto') continue;
    const item = index.get(dayKey(e.at));
    if (item) item.count += 1;
  }
  return out;
}

export interface Streaks {
  current: number;
  longest: number;
  activeToday: boolean;
}

function dayNumber(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** A streak is a run of consecutive calendar days with at least one change. */
export function computeStreaks(entries: HistoryEntry[], now: number): Streaks {
  const keys = new Set<string>();
  for (const e of entries) if (e.kind !== 'goal') keys.add(dayKey(e.at));
  if (keys.size === 0) return { current: 0, longest: 0, activeToday: false };

  const numbers = Array.from(keys, dayNumber).sort((a, b) => a - b);
  let longest = 1;
  let run = 1;
  for (let i = 1; i < numbers.length; i++) {
    run = numbers[i] === numbers[i - 1] + 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const todayKey = dayKey(now);
  const activeToday = keys.has(todayKey);
  let n = dayNumber(todayKey);
  if (!activeToday) n -= 1;
  const set = new Set(numbers);
  let current = 0;
  while (set.has(n)) {
    current += 1;
    n -= 1;
  }
  return { current, longest, activeToday };
}

export interface SessionInfo {
  id: string;
  start: number;
  end: number;
  events: number;
  net: number;
  counters: number;
}

export function sessionsFrom(entries: HistoryEntry[]): SessionInfo[] {
  const map = new Map<string, SessionInfo & { ids: Set<string> }>();
  for (const e of entries) {
    if (e.kind === 'goal') continue;
    let s = map.get(e.session);
    if (!s) {
      s = { id: e.session, start: e.at, end: e.at, events: 0, net: 0, counters: 0, ids: new Set() };
      map.set(e.session, s);
    }
    s.start = Math.min(s.start, e.at);
    s.end = Math.max(s.end, e.at);
    s.events += 1;
    s.net += e.delta;
    s.ids.add(e.counterId);
  }
  return Array.from(map.values())
    .map(({ ids, ...rest }) => ({ ...rest, counters: ids.size }))
    .sort((a, b) => b.start - a.start);
}

export interface CounterStats {
  counter: Counter;
  summary: Summary;
  lastActivity: number | null;
}

export function statsByCounter(entries: HistoryEntry[], counters: Counter[]): CounterStats[] {
  const byId = new Map<string, HistoryEntry[]>();
  for (const e of entries) {
    const list = byId.get(e.counterId);
    if (list) list.push(e);
    else byId.set(e.counterId, [e]);
  }
  return counters
    .map((counter) => {
      const list = byId.get(counter.id) ?? [];
      const last = list.reduce<number | null>((m, e) => (m === null || e.at > m ? e.at : m), null);
      return { counter, summary: summarize(list), lastActivity: last };
    })
    .sort((a, b) => b.summary.activity - a.summary.activity);
}

export function goalHistory(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter((e) => e.kind === 'goal').sort((a, b) => b.at - a.at);
}
