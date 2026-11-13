import type { CardStyle, Counter, CounterConfig, CounterMode, Player, Snapshot, SubCounter } from './types';
import { uid } from './ids';
import { isValidColor, SWATCHES } from './colors';
import { arr, isRecord, MAX_ABS, num, numOrNull, oneOf, str, bool } from './sanitize';

export const MODES: CounterMode[] = ['normal', 'countdown', 'goal', 'score', 'tally', 'interval', 'multi'];
export const CARD_STYLES: CardStyle[] = ['solid', 'glass', 'outline', 'gradient'];

export interface ModeInfo {
  id: CounterMode;
  name: string;
  blurb: string;
  icon: string;
}

export const MODE_INFO: Record<CounterMode, ModeInfo> = {
  normal: { id: 'normal', name: 'Counter', blurb: 'Count up and down by any amount.', icon: 'hash' },
  countdown: { id: 'countdown', name: 'Countdown', blurb: 'Start high and count down to zero.', icon: 'timer' },
  goal: { id: 'goal', name: 'Goal', blurb: 'Set a target and watch your progress.', icon: 'target' },
  score: { id: 'score', name: 'Score', blurb: 'Keep score for two or more players or teams.', icon: 'trophy' },
  tally: { id: 'tally', name: 'Tally', blurb: 'Classic tally marks, grouped in fives.', icon: 'tally' },
  interval: { id: 'interval', name: 'Interval', blurb: 'Counts by itself at a steady tempo.', icon: 'repeat' },
  multi: { id: 'multi', name: 'Multi-counter', blurb: 'Several counters together on one screen.', icon: 'layout-grid' },
};

/* ---------- number helpers ---------- */

export function roundNum(n: number): number {
  return Math.round(n * 1e9) / 1e9 + 0; // "+ 0" turns -0 into 0
}

export function clampValue(v: number, min: number | null, max: number | null): number {
  let r = Number.isNaN(v) ? 0 : v;
  if (max !== null && r > max) r = max;
  if (min !== null && r < min) r = min;
  r = Math.max(-MAX_ABS, Math.min(MAX_ABS, r));
  return roundNum(r);
}

export function normalizeLimits(min: number | null, max: number | null): { min: number | null; max: number | null } {
  if (min !== null && max !== null && min > max) return { min: max, max: min };
  return { min, max };
}

export interface ChangeOutcome {
  prev: number;
  next: number;
  /** Actual change after clamping (may be smaller than requested, or 0). */
  delta: number;
  /** Which limit stopped the change, if any. */
  hit: 'min' | 'max' | null;
}

export function applyDelta(current: number, delta: number, min: number | null, max: number | null): ChangeOutcome {
  const raw = roundNum(current + delta);
  const next = clampValue(raw, min, max);
  let hit: 'min' | 'max' | null = null;
  if (max !== null && raw > max) hit = 'max';
  else if (min !== null && raw < min) hit = 'min';
  return { prev: current, next, delta: roundNum(next - current), hit };
}

/** Countdown counters move down when the big button is pressed. */
export function primaryDirection(mode: CounterMode): 1 | -1 {
  return mode === 'countdown' ? -1 : 1;
}

/** The value that finishes a goal or countdown counter, or null for other modes. */
export function completionTarget(c: Pick<Counter, 'mode' | 'goal' | 'min'>): number | null {
  if (c.mode === 'goal' && c.goal !== null && c.goal !== 0) return c.goal;
  if (c.mode === 'countdown') return c.min ?? 0;
  return null;
}

/** True when a change crosses the finish line of a goal or countdown counter. */
export function didComplete(c: Pick<Counter, 'mode' | 'goal' | 'min'>, prev: number, next: number): boolean {
  const target = completionTarget(c);
  if (target === null) return false;
  if (c.mode === 'countdown') return prev > target && next <= target;
  return prev < target && next >= target;
}

/** Progress towards the finish line, from 0 to 1. */
export function goalProgress(c: Pick<Counter, 'mode' | 'goal' | 'value' | 'startValue' | 'min'>, value = c.value): number {
  if (c.mode === 'countdown') {
    const end = c.min ?? 0;
    const span = c.startValue - end;
    if (span <= 0) return value <= end ? 1 : 0;
    return Math.max(0, Math.min(1, (c.startValue - value) / span));
  }
  if (c.goal === null || c.goal === 0) return 0;
  const base = Math.min(0, c.startValue);
  const span = c.goal - base;
  if (span === 0) return 1;
  return Math.max(0, Math.min(1, (value - base) / span));
}

export function tallyGroups(n: number): { groups: number; remainder: number; negative: boolean } {
  const whole = Math.floor(Math.abs(n));
  return { groups: Math.floor(whole / 5), remainder: whole % 5, negative: n < 0 };
}

/** A single number that best summarises a counter (sum for multi counters and scoreboards). */
export function counterTotal(c: Pick<Counter, 'mode' | 'value' | 'players' | 'subCounters'>): number {
  if (c.mode === 'score') return roundNum(c.players.reduce((s, p) => s + p.score, 0));
  if (c.mode === 'multi') return roundNum(c.subCounters.reduce((s, p) => s + p.value, 0));
  return c.value;
}

/* ---------- snapshots ---------- */

export function snapshotOf(c: Pick<Counter, 'value' | 'players' | 'subCounters'>): Snapshot {
  return {
    value: c.value,
    players: c.players.map((p) => ({ ...p })),
    subCounters: c.subCounters.map((s) => ({ ...s })),
  };
}

export function snapshotsEqual(a: Snapshot, b: Snapshot): boolean {
  if (a.value !== b.value) return false;
  if (a.players.length !== b.players.length || a.subCounters.length !== b.subCounters.length) return false;
  return (
    a.players.every((p, i) => p.id === b.players[i].id && p.score === b.players[i].score) &&
    a.subCounters.every((s, i) => s.id === b.subCounters[i].id && s.value === b.subCounters[i].value)
  );
}

/* ---------- creation & sanitising ---------- */

function modeDefaults(mode: CounterMode): Pick<Counter, 'startValue' | 'min' | 'max' | 'goal' | 'intervalMs' | 'step'> {
  switch (mode) {
    case 'countdown':
      return { startValue: 10, min: 0, max: null, goal: null, intervalMs: 1000, step: 1 };
    case 'goal':
      return { startValue: 0, min: 0, max: null, goal: 100, intervalMs: 1000, step: 1 };
    case 'interval':
      return { startValue: 0, min: null, max: null, goal: null, intervalMs: 1000, step: 1 };
    default:
      return { startValue: 0, min: null, max: null, goal: null, intervalMs: 1000, step: 1 };
  }
}

const PLAYER_NAMES = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];

export function newPlayer(index: number, name?: string): Player {
  return {
    id: uid('p'),
    name: name ?? PLAYER_NAMES[index] ?? `Player ${index + 1}`,
    score: 0,
    color: SWATCHES[(index * 3 + 1) % SWATCHES.length].id,
  };
}

export function newSubCounter(index: number, name?: string): SubCounter {
  return {
    id: uid('s'),
    name: name ?? `Counter ${String.fromCharCode(65 + (index % 26))}`,
    value: 0,
    color: SWATCHES[(index * 2 + 3) % SWATCHES.length].id,
  };
}

export function createCounter(partial: Partial<Counter> = {}, now = Date.now()): Counter {
  const mode = partial.mode ?? 'normal';
  const d = modeDefaults(mode);
  const lim = normalizeLimits(
    partial.min !== undefined ? partial.min : d.min,
    partial.max !== undefined ? partial.max : d.max,
  );
  const startValue = clampValue(partial.startValue ?? d.startValue, lim.min, lim.max);
  const value = clampValue(partial.value ?? startValue, lim.min, lim.max);
  const players =
    partial.players ?? (mode === 'score' ? [newPlayer(0), newPlayer(1)] : []);
  const subCounters =
    partial.subCounters ?? (mode === 'multi' ? [newSubCounter(0), newSubCounter(1), newSubCounter(2)] : []);
  const step = partial.step !== undefined && partial.step > 0 ? partial.step : d.step;
  return {
    id: partial.id ?? uid('c'),
    name: partial.name ?? (mode === 'normal' ? 'Untitled counter' : `New ${MODE_INFO[mode].name.toLowerCase()}`),
    description: partial.description ?? '',
    mode,
    color: partial.color ?? 'ember',
    icon: partial.icon ?? MODE_INFO[mode].icon,
    value,
    startValue,
    step,
    min: lim.min,
    max: lim.max,
    goal: partial.goal !== undefined ? partial.goal : d.goal,
    intervalMs: partial.intervalMs ?? d.intervalMs,
    intervalDirection: partial.intervalDirection ?? 1,
    players,
    subCounters,
    folderId: partial.folderId ?? null,
    pinned: partial.pinned ?? false,
    order: partial.order ?? 0,
    cardStyle: partial.cardStyle ?? 'solid',
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    lastUsedAt: partial.lastUsedAt ?? now,
    deletedAt: partial.deletedAt ?? null,
  };
}

function sanitizePlayers(raw: unknown): Player[] {
  const out: Player[] = [];
  arr(raw, 12).forEach((p, i) => {
    if (!isRecord(p)) return;
    out.push({
      id: str(p.id, 40) || uid('p'),
      name: str(p.name, 40) || `Player ${i + 1}`,
      score: roundNum(num(p.score, 0)),
      color: isValidColor(p.color) ? p.color : SWATCHES[i % SWATCHES.length].id,
    });
  });
  return out;
}

function sanitizeSubCounters(raw: unknown): SubCounter[] {
  const out: SubCounter[] = [];
  arr(raw, 24).forEach((s, i) => {
    if (!isRecord(s)) return;
    out.push({
      id: str(s.id, 40) || uid('s'),
      name: str(s.name, 40) || `Counter ${i + 1}`,
      value: roundNum(num(s.value, 0)),
      color: isValidColor(s.color) ? s.color : SWATCHES[i % SWATCHES.length].id,
    });
  });
  return out;
}

/** Turn untrusted data into a valid Counter, or null when it is not a counter at all. */
export function sanitizeCounter(raw: unknown, now = Date.now()): Counter | null {
  if (!isRecord(raw)) return null;
  const mode = oneOf(raw.mode, MODES, 'normal');
  const min = numOrNull(raw.min, null);
  const max = numOrNull(raw.max, null);
  const step = num(raw.step, 1, 0.000001, MAX_ABS);
  const created = num(raw.createdAt, now, 0, 8.64e15);
  const players = sanitizePlayers(raw.players);
  const subCounters = sanitizeSubCounters(raw.subCounters);
  return createCounter(
    {
      id: str(raw.id, 60) || uid('c'),
      name: str(raw.name, 80, 'Untitled counter') || 'Untitled counter',
      description: str(raw.description, 500),
      mode,
      color: isValidColor(raw.color) ? raw.color : 'ember',
      icon: str(raw.icon, 40) || MODE_INFO[mode].icon,
      value: num(raw.value, 0),
      startValue: num(raw.startValue, 0),
      step,
      min,
      max,
      goal: numOrNull(raw.goal, null),
      intervalMs: num(raw.intervalMs, 1000, 50, 3_600_000),
      intervalDirection: raw.intervalDirection === -1 ? -1 : 1,
      players: mode === 'score' && players.length === 0 ? undefined : players,
      subCounters: mode === 'multi' && subCounters.length === 0 ? undefined : subCounters,
      folderId: typeof raw.folderId === 'string' ? str(raw.folderId, 60) || null : null,
      pinned: bool(raw.pinned, false),
      order: num(raw.order, 0, -1e9, 1e9),
      cardStyle: oneOf(raw.cardStyle, CARD_STYLES, 'solid'),
      createdAt: created,
      updatedAt: num(raw.updatedAt, created, 0, 8.64e15),
      lastUsedAt: num(raw.lastUsedAt, created, 0, 8.64e15),
      deletedAt: numOrNull(raw.deletedAt, null, 0, 8.64e15),
    },
    now,
  );
}

/** The reusable configuration of a counter (no value history, ids or timestamps). */
export function configOf(c: Counter): CounterConfig {
  return {
    description: c.description,
    mode: c.mode,
    icon: c.icon,
    color: c.color,
    startValue: c.startValue,
    step: c.step,
    min: c.min,
    max: c.max,
    goal: c.goal,
    intervalMs: c.intervalMs,
    intervalDirection: c.intervalDirection,
    cardStyle: c.cardStyle,
    players: c.players.map((p) => ({ name: p.name, color: p.color })),
    subCounters: c.subCounters.map((s) => ({ name: s.name, color: s.color })),
  };
}

/** Build a fresh counter from a stored configuration. */
export function counterFromConfig(config: CounterConfig, name: string, now = Date.now()): Counter {
  return createCounter(
    {
      name,
      description: config.description,
      mode: config.mode,
      icon: config.icon,
      color: config.color,
      startValue: config.startValue,
      step: config.step,
      min: config.min,
      max: config.max,
      goal: config.goal,
      intervalMs: config.intervalMs,
      intervalDirection: config.intervalDirection,
      cardStyle: config.cardStyle,
      players: config.players.map((p) => ({ id: uid('p'), name: p.name, color: p.color, score: 0 })),
      subCounters: config.subCounters.map((s) => ({ id: uid('s'), name: s.name, color: s.color, value: 0 })),
    },
    now,
  );
}

export function sanitizeConfig(raw: unknown): CounterConfig | null {
  const c = sanitizeCounter(isRecord(raw) ? { ...raw, id: 'x' } : raw);
  if (!c) return null;
  return configOf(c);
}
