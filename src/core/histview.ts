import type { HistoryEntry } from './types';
import { roundNum } from './counter';
import { dayKey, formatDateTime, formatNumber, signed } from './format';
import { addBucket, bucketStart, startOfDay, startOfMonth, startOfWeek } from './stats';
import type { Bucket, CounterStats, TimeWindow } from './stats';

/* ------------------------------------------------------------------ */
/* Kinds                                                               */
/* ------------------------------------------------------------------ */

export type KindGroup = 'inc' | 'dec' | 'edit' | 'undo' | 'goal';

export const KIND_GROUPS: { id: KindGroup; label: string }[] = [
  { id: 'inc', label: 'Increments' },
  { id: 'dec', label: 'Decrements' },
  { id: 'edit', label: 'Edits' },
  { id: 'undo', label: 'Undos' },
  { id: 'goal', label: 'Goals' },
];

/** Which filter chip an entry belongs to. Automatic counts follow their direction. */
export function kindGroup(e: Pick<HistoryEntry, 'kind' | 'delta'>): KindGroup {
  switch (e.kind) {
    case 'inc':
      return 'inc';
    case 'dec':
      return 'dec';
    case 'auto':
      return e.delta < 0 ? 'dec' : 'inc';
    case 'set':
    case 'reset':
      return 'edit';
    case 'undo':
      return 'undo';
    case 'goal':
      return 'goal';
  }
}

export function kindLabel(e: Pick<HistoryEntry, 'kind' | 'delta'>): string {
  switch (e.kind) {
    case 'inc':
      return 'Increase';
    case 'dec':
      return 'Decrease';
    case 'auto':
      return e.delta < 0 ? 'Automatic decrease' : 'Automatic increase';
    case 'set':
      return 'Set manually';
    case 'reset':
      return 'Reset';
    case 'undo':
      return 'Undo';
    case 'goal':
      return 'Milestone';
  }
}

/** True for entries that count as activity in the statistics (a real up or down step). */
export function isActivity(e: Pick<HistoryEntry, 'kind' | 'delta'>): boolean {
  return (e.kind === 'inc' || e.kind === 'dec' || e.kind === 'auto') && e.delta !== 0;
}

/* ------------------------------------------------------------------ */
/* Dates (always local time)                                           */
/* ------------------------------------------------------------------ */

/** Parse the value of an <input type="date"> ("2026-11-10") as local midnight. */
export function parseDateInput(value: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date.getTime();
}

/** The value to put in an <input type="date"> for a timestamp. */
export function dateInputValue(ts: number): string {
  return dayKey(ts);
}

/** The last millisecond of the local day that contains ts. */
export function endOfDay(ts: number): number {
  return addBucket(startOfDay(ts), 'day', 1) - 1;
}

/* ------------------------------------------------------------------ */
/* Filtering                                                           */
/* ------------------------------------------------------------------ */

export interface HistoryFilters {
  counterId: string | null;
  query: string;
  /** Inclusive start (local midnight of the From date). */
  from: number | null;
  /** Inclusive end (last millisecond of the To date). */
  to: number | null;
  /** Empty means every kind. */
  kinds: KindGroup[];
}

export const NO_FILTERS: HistoryFilters = { counterId: null, query: '', from: null, to: null, kinds: [] };

export function hasActiveFilters(f: HistoryFilters): boolean {
  return f.query.trim() !== '' || f.from !== null || f.to !== null || f.kinds.length > 0;
}

/**
 * Every word in the search must appear somewhere in the counter name, the player or
 * counter label, the kind, the numbers, or the formatted date and time.
 */
export function matchesQuery(e: HistoryEntry, counterName: string, query: string): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const cheap = [
    counterName,
    e.label ?? '',
    kindLabel(e),
    e.reverted ? 'reverted' : '',
    String(e.prev),
    String(e.next),
    String(e.delta),
    formatNumber(e.prev),
    formatNumber(e.next),
    formatNumber(e.delta),
    signed(e.delta),
  ]
    .join(' | ')
    .toLowerCase();
  let dateText: string | null = null;
  return tokens.every((t) => {
    if (cheap.includes(t)) return true;
    if (dateText === null) dateText = formatDateTime(e.at).toLowerCase();
    return dateText.includes(t);
  });
}

/** Filter and return newest first. `entries` may be in any order. */
export function filterEntries(entries: HistoryEntry[], f: HistoryFilters, names: Record<string, string>): HistoryEntry[] {
  const kinds = f.kinds.length ? new Set<KindGroup>(f.kinds) : null;
  const out: HistoryEntry[] = [];
  for (const e of entries) {
    if (f.counterId !== null && e.counterId !== f.counterId) continue;
    if (f.from !== null && e.at < f.from) continue;
    if (f.to !== null && e.at > f.to) continue;
    if (kinds && !kinds.has(kindGroup(e))) continue;
    if (!matchesQuery(e, names[e.counterId] ?? '', f.query)) continue;
    out.push(e);
  }
  return out.sort((a, b) => b.at - a.at);
}

/** Number of changes (milestones excluded) and their combined net effect. */
export function summarizeView(entries: HistoryEntry[]): { changes: number; milestones: number; net: number } {
  let changes = 0;
  let milestones = 0;
  let net = 0;
  for (const e of entries) {
    if (e.kind === 'goal') {
      milestones += 1;
      continue;
    }
    changes += 1;
    net += e.delta;
  }
  return { changes, milestones, net: roundNum(net) };
}

/* ------------------------------------------------------------------ */
/* Grouping                                                            */
/* ------------------------------------------------------------------ */

export interface DayGroup {
  key: string;
  label: string;
  start: number;
  entries: HistoryEntry[];
}

export function dayHeading(start: number, now: number): string {
  const today = startOfDay(now);
  if (dayKey(start) === dayKey(today)) return 'Today';
  if (dayKey(start) === dayKey(addBucket(today, 'day', -1))) return 'Yesterday';
  const sameYear = new Date(start).getFullYear() === new Date(now).getFullYear();
  return new Date(start).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** Group newest-first entries under one heading per local calendar day. */
export function groupByDay(entries: HistoryEntry[], now: number): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const e of entries) {
    const key = dayKey(e.at);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(e);
    } else {
      const start = startOfDay(e.at);
      groups.push({ key, label: dayHeading(start, now), start, entries: [e] });
    }
  }
  return groups;
}

/* ------------------------------------------------------------------ */
/* Statistics helpers                                                  */
/* ------------------------------------------------------------------ */

/** Percentage change, or null when there is no earlier value to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export type Granularity = 'auto' | 'day' | 'week' | 'month';

export const GRANULARITIES: { id: Granularity; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'day', label: 'Daily' },
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
];

export const MAX_BARS = 120;

export function bucketCount(win: TimeWindow, bucket: Bucket): number {
  let cursor = bucketStart(win.from, bucket);
  let n = 0;
  while (cursor <= win.to && n <= MAX_BARS + 1) {
    n += 1;
    cursor = addBucket(cursor, bucket, 1);
  }
  return n;
}

/** A granularity is offered when it gives between 2 and 120 bars for the window. */
export function granularityAllowed(win: TimeWindow, g: Granularity): boolean {
  if (g === 'auto') return true;
  const n = bucketCount(win, g);
  return n >= 2 && n <= MAX_BARS;
}

export function resolveBucket(win: TimeWindow, g: Granularity): Bucket {
  return g !== 'auto' && granularityAllowed(win, g) ? g : win.bucket;
}

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** Activity per weekday, Monday first. */
export function weekdayCounts(entries: HistoryEntry[]): number[] {
  const out = new Array<number>(7).fill(0);
  for (const e of entries) {
    if (!isActivity(e)) continue;
    out[(new Date(e.at).getDay() + 6) % 7] += 1;
  }
  return out;
}

/** Activity per hour of the day (0 to 23). */
export function hourCounts(entries: HistoryEntry[]): number[] {
  const out = new Array<number>(24).fill(0);
  for (const e of entries) {
    if (!isActivity(e)) continue;
    out[new Date(e.at).getHours()] += 1;
  }
  return out;
}

export interface PeriodActivity {
  previous: number;
  current: number;
  previousStart: number;
  currentStart: number;
}

/** Activity in the current calendar week or month so far, against the whole one before. */
export function activityByPeriod(entries: HistoryEntry[], now: number, unit: 'week' | 'month'): PeriodActivity {
  const currentStart = unit === 'week' ? startOfWeek(now) : startOfMonth(now);
  const previousStart = addBucket(currentStart, unit, -1);
  let previous = 0;
  let current = 0;
  for (const e of entries) {
    if (!isActivity(e)) continue;
    if (e.at >= currentStart && e.at <= now) current += 1;
    else if (e.at >= previousStart && e.at < currentStart) previous += 1;
  }
  return { previous, current, previousStart, currentStart };
}

export type CounterSortKey = 'name' | 'activity' | 'net' | 'highest' | 'lowest' | 'last';

function sortValue(row: CounterStats, key: CounterSortKey): number | string | null {
  switch (key) {
    case 'name':
      return row.counter.name.toLowerCase();
    case 'activity':
      return row.summary.activity;
    case 'net':
      return row.summary.net;
    case 'highest':
      return row.summary.highest;
    case 'lowest':
      return row.summary.lowest;
    case 'last':
      return row.lastActivity;
  }
}

/** Sort per-counter rows. Rows with no value for the column always go last. */
export function sortCounterStats(rows: CounterStats[], key: CounterSortKey, dir: 'asc' | 'desc'): CounterStats[] {
  const sign = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = sortValue(a, key);
    const vb = sortValue(b, key);
    if (va === null && vb === null) return a.counter.name.localeCompare(b.counter.name);
    if (va === null) return 1;
    if (vb === null) return -1;
    if (va < vb) return -1 * sign;
    if (va > vb) return 1 * sign;
    return a.counter.name.localeCompare(b.counter.name);
  });
}
