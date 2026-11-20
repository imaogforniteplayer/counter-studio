/** Pure logic behind the Tools page. Randomness is injectable so it can be tested. */

export type Rng = () => number;

/** A random float in [0, 1). Uses the browser's crypto source when there is one. */
export const secureRandom: Rng = () => {
  const c = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (c && typeof c.getRandomValues === 'function') {
    const buf = new Uint32Array(2);
    c.getRandomValues(buf);
    // 53 random bits
    return (buf[0] * 2 ** 21 + (buf[1] >>> 11)) / 2 ** 53;
  }
  return Math.random();
};

/** An integer from min to max, both included. */
export function randomInt(min: number, max: number, rng: Rng = secureRandom): number {
  const lo = Math.ceil(Math.min(min, max));
  const hi = Math.floor(Math.max(min, max));
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function shuffle<T>(list: readonly T[], rng: Rng = secureRandom): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* ---------------- dice ---------------- */

export interface DiceSpec {
  count: number;
  sides: number;
  modifier: number;
}

export const MAX_DICE = 50;
export const MAX_SIDES = 1000;

export function validDice(s: DiceSpec): boolean {
  return Number.isInteger(s.count) && s.count >= 1 && s.count <= MAX_DICE && Number.isInteger(s.sides) && s.sides >= 2 && s.sides <= MAX_SIDES && Number.isInteger(s.modifier) && Math.abs(s.modifier) <= 100_000;
}

/** "2d6+3", "d20", "4d8 - 1". Returns null when it is not valid dice notation. */
export function parseDiceNotation(text: string): DiceSpec | null {
  const m = /^\s*(\d*)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?\s*$/i.exec(text);
  if (!m) return null;
  const spec: DiceSpec = {
    count: m[1] === '' ? 1 : Number(m[1]),
    sides: Number(m[2]),
    modifier: m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0,
  };
  return validDice(spec) ? spec : null;
}

export function formatDice(s: DiceSpec): string {
  return `${s.count}d${s.sides}${s.modifier > 0 ? `+${s.modifier}` : s.modifier < 0 ? String(s.modifier) : ''}`;
}

export interface DiceRoll {
  spec: DiceSpec;
  rolls: number[];
  total: number;
}

export function rollDice(spec: DiceSpec, rng: Rng = secureRandom): DiceRoll {
  const rolls = Array.from({ length: spec.count }, () => randomInt(1, spec.sides, rng));
  return { spec, rolls, total: rolls.reduce((a, b) => a + b, 0) + spec.modifier };
}

/* ---------------- tap tempo ---------------- */

/** Taps further apart than this start a fresh measurement. */
export const TAP_RESET_MS = 2500;

/** Beats per minute from tap times (ms), using the most recent taps. Needs at least two. */
export function bpmFromTaps(times: number[], maxTaps = 8): number | null {
  const t = times.slice(-maxTaps);
  if (t.length < 2) return null;
  const span = t[t.length - 1] - t[0];
  if (span <= 0) return null;
  return Math.round(((t.length - 1) / span) * 60_000 * 10) / 10;
}

/** Add a tap to a list, starting over after a long pause. */
export function addTap(times: number[], at: number): number[] {
  const last = times[times.length - 1];
  return last !== undefined && at - last > TAP_RESET_MS ? [at] : [...times, at].slice(-16);
}

/* ---------------- pace ---------------- */

export interface Pace {
  remaining: number;
  daysLeft: number;
  perDay: number | null;
  perWeek: number | null;
  done: boolean;
  overdue: boolean;
}

/** What it takes to reach a target by a deadline. Days are counted in whole days, including today. */
export function pace(target: number, current: number, deadline: number, now: number): Pace {
  const remaining = Math.max(0, target - current);
  const done = current >= target;
  const msLeft = deadline - now;
  const daysLeft = msLeft <= 0 ? 0 : Math.ceil(msLeft / 86_400_000);
  const overdue = !done && daysLeft === 0;
  const perDay = done || daysLeft === 0 ? null : Math.ceil((remaining / daysLeft) * 100) / 100;
  const perWeek = perDay === null ? null : Math.ceil(perDay * 7 * 100) / 100;
  return { remaining, daysLeft, perDay, perWeek, done, overdue };
}

/* ---------------- timer input ---------------- */

export const MAX_TIMER_MS = 99 * 3_600_000 + 59 * 60_000 + 59_000;

export function toMs(hours: number, minutes: number, seconds: number): number {
  const clean = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  return Math.min(MAX_TIMER_MS, clean(hours) * 3_600_000 + clean(minutes) * 60_000 + clean(seconds) * 1000);
}

/* ---------------- laps ---------------- */

export interface Lap {
  n: number;
  split: number;
  total: number;
}

export function addLap(laps: Lap[], total: number): Lap[] {
  const prev = laps.length ? laps[laps.length - 1].total : 0;
  return [...laps, { n: laps.length + 1, split: Math.max(0, total - prev), total }];
}

export function lapExtremes(laps: Lap[]): { fastest: number | null; slowest: number | null } {
  if (laps.length < 2) return { fastest: null, slowest: null };
  let fastest = laps[0];
  let slowest = laps[0];
  for (const l of laps) {
    if (l.split < fastest.split) fastest = l;
    if (l.split > slowest.split) slowest = l;
  }
  return { fastest: fastest.n, slowest: slowest.n };
}

/* ---------------- focus intervals (Pomodoro) ---------------- */

export type FocusPhase = 'focus' | 'short' | 'long';

export interface FocusPlan {
  /** Minutes of work in each focus session. */
  focusMin: number;
  /** Minutes of rest between focus sessions. */
  shortMin: number;
  /** Minutes of rest after the last focus session of a set. */
  longMin: number;
  /** Focus sessions in one set. The last one is followed by the long break. */
  sessions: number;
}

export const DEFAULT_FOCUS_PLAN: FocusPlan = { focusMin: 25, shortMin: 5, longMin: 15, sessions: 4 };

export const FOCUS_LIMITS = {
  focusMin: { min: 1, max: 180 },
  shortMin: { min: 1, max: 60 },
  longMin: { min: 1, max: 120 },
  sessions: { min: 2, max: 8 },
} as const;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Whatever was typed becomes a plan that is always valid. */
export function sanitizeFocusPlan(raw: Partial<Record<keyof FocusPlan, unknown>> = {}): FocusPlan {
  const d = DEFAULT_FOCUS_PLAN;
  const L = FOCUS_LIMITS;
  return {
    focusMin: clampInt(raw.focusMin, L.focusMin.min, L.focusMin.max, d.focusMin),
    shortMin: clampInt(raw.shortMin, L.shortMin.min, L.shortMin.max, d.shortMin),
    longMin: clampInt(raw.longMin, L.longMin.min, L.longMin.max, d.longMin),
    sessions: clampInt(raw.sessions, L.sessions.min, L.sessions.max, d.sessions),
  };
}

export interface FocusStep {
  phase: FocusPhase;
  ms: number;
  /** Which focus session of the set this is (or follows), starting at 1. */
  session: number;
  /** Which set this step belongs to, starting at 1. */
  set: number;
}

/**
 * Step number `index` (from 0) of the endless schedule:
 * focus, short, focus, short … focus, long, then it starts over.
 */
export function focusStep(plan: FocusPlan, index: number): FocusStep {
  const i = Math.max(0, Math.floor(index));
  const length = plan.sessions * 2;
  const at = i % length;
  const set = Math.floor(i / length) + 1;
  if (at % 2 === 0) return { phase: 'focus', ms: plan.focusMin * 60_000, session: at / 2 + 1, set };
  const session = (at - 1) / 2 + 1;
  return at === length - 1
    ? { phase: 'long', ms: plan.longMin * 60_000, session, set }
    : { phase: 'short', ms: plan.shortMin * 60_000, session, set };
}

/** Focus sessions that were finished once `stepsDone` steps are complete. */
export function focusSessionsDone(stepsDone: number): number {
  return Math.ceil(Math.max(0, Math.floor(stepsDone)) / 2);
}

/** Total focus time so far, counting the part of the current step that has passed. */
export function focusTimeDone(plan: FocusPlan, stepsDone: number, elapsedInStep = 0): number {
  const done = Math.max(0, Math.floor(stepsDone));
  let total = focusSessionsDone(done) * plan.focusMin * 60_000;
  const current = focusStep(plan, done);
  if (current.phase === 'focus') total += Math.min(current.ms, Math.max(0, elapsedInStep));
  return total;
}
