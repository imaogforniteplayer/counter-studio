import { describe, expect, it } from 'vitest';
import {
  applyDelta,
  clampValue,
  completionTarget,
  counterFromConfig,
  counterTotal,
  configOf,
  createCounter,
  didComplete,
  goalProgress,
  normalizeLimits,
  primaryDirection,
  roundNum,
  sanitizeCounter,
  snapshotOf,
  snapshotsEqual,
  tallyGroups,
} from './counter';

describe('number helpers', () => {
  it('rounds away floating point noise and negative zero', () => {
    expect(roundNum(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(roundNum(-0), 0)).toBe(true);
  });

  it('clamps to limits and handles non-finite input', () => {
    expect(clampValue(15, 0, 10)).toBe(10);
    expect(clampValue(-3, 0, 10)).toBe(0);
    expect(clampValue(5, null, null)).toBe(5);
    expect(clampValue(Number.NaN, null, null)).toBe(0);
    expect(clampValue(Infinity, null, null)).toBe(1_000_000_000_000_000);
  });

  it('swaps limits that are the wrong way round', () => {
    expect(normalizeLimits(10, 2)).toEqual({ min: 2, max: 10 });
    expect(normalizeLimits(null, 5)).toEqual({ min: null, max: 5 });
  });
});

describe('applyDelta', () => {
  it('adds and subtracts', () => {
    expect(applyDelta(5, 1, null, null)).toEqual({ prev: 5, next: 6, delta: 1, hit: null });
    expect(applyDelta(5, -7, null, null).next).toBe(-2);
  });

  it('stops at the maximum and reports the real delta', () => {
    const r = applyDelta(8, 5, 0, 10);
    expect(r.next).toBe(10);
    expect(r.delta).toBe(2);
    expect(r.hit).toBe('max');
  });

  it('stops at the minimum', () => {
    const r = applyDelta(2, -5, 0, 10);
    expect(r.next).toBe(0);
    expect(r.delta).toBe(-2);
    expect(r.hit).toBe('min');
  });

  it('reports a zero delta when already at the limit', () => {
    const r = applyDelta(10, 1, 0, 10);
    expect(r.delta).toBe(0);
    expect(r.hit).toBe('max');
  });

  it('supports decimal steps without drift', () => {
    let v = 0;
    for (let i = 0; i < 10; i++) v = applyDelta(v, 0.1, null, null).next;
    expect(v).toBe(1);
  });
});

describe('modes', () => {
  it('counts down for countdown counters only', () => {
    expect(primaryDirection('countdown')).toBe(-1);
    expect(primaryDirection('normal')).toBe(1);
    expect(primaryDirection('tally')).toBe(1);
  });

  it('countdown defaults start at 10 with a floor of zero', () => {
    const c = createCounter({ mode: 'countdown' });
    expect(c.value).toBe(10);
    expect(c.min).toBe(0);
    expect(completionTarget(c)).toBe(0);
  });

  it('detects countdown completion once', () => {
    const c = createCounter({ mode: 'countdown', startValue: 3 });
    expect(didComplete(c, 1, 0)).toBe(true);
    expect(didComplete(c, 0, 0)).toBe(false);
    expect(didComplete(c, 3, 2)).toBe(false);
  });

  it('detects goal completion when crossing the target', () => {
    const c = createCounter({ mode: 'goal', goal: 10 });
    expect(didComplete(c, 9, 10)).toBe(true);
    expect(didComplete(c, 9, 12)).toBe(true);
    expect(didComplete(c, 10, 11)).toBe(false);
    expect(didComplete(c, 5, 6)).toBe(false);
  });

  it('never reports completion for modes without a finish line', () => {
    const c = createCounter({ mode: 'normal' });
    expect(didComplete(c, 0, 100)).toBe(false);
  });

  it('computes goal progress between 0 and 1', () => {
    const c = createCounter({ mode: 'goal', goal: 50, value: 25 });
    expect(goalProgress(c)).toBe(0.5);
    expect(goalProgress({ ...c, value: 80 })).toBe(1);
    expect(goalProgress({ ...c, value: -5 })).toBe(0);
  });

  it('computes countdown progress from the start value', () => {
    const c = createCounter({ mode: 'countdown', startValue: 20, value: 5 });
    expect(goalProgress(c)).toBe(0.75);
  });

  it('groups tally marks in fives', () => {
    expect(tallyGroups(0)).toEqual({ groups: 0, remainder: 0, negative: false });
    expect(tallyGroups(4)).toEqual({ groups: 0, remainder: 4, negative: false });
    expect(tallyGroups(5)).toEqual({ groups: 1, remainder: 0, negative: false });
    expect(tallyGroups(13)).toEqual({ groups: 2, remainder: 3, negative: false });
    expect(tallyGroups(-7).negative).toBe(true);
  });

  it('creates two players for score counters and three for multi counters', () => {
    expect(createCounter({ mode: 'score' }).players).toHaveLength(2);
    expect(createCounter({ mode: 'multi' }).subCounters).toHaveLength(3);
    expect(createCounter({ mode: 'normal' }).players).toHaveLength(0);
  });

  it('totals scores and sub counters', () => {
    const s = createCounter({ mode: 'score' });
    s.players[0].score = 4;
    s.players[1].score = 6;
    expect(counterTotal(s)).toBe(10);
    const m = createCounter({ mode: 'multi' });
    m.subCounters[2].value = 7;
    expect(counterTotal(m)).toBe(7);
    expect(counterTotal(createCounter({ value: 3 }))).toBe(3);
  });
});

describe('createCounter', () => {
  it('clamps start and current values into the limits', () => {
    const c = createCounter({ min: 0, max: 10, startValue: 50 });
    expect(c.startValue).toBe(10);
    expect(c.value).toBe(10);
  });

  it('uses the start value as the first value', () => {
    expect(createCounter({ startValue: 7 }).value).toBe(7);
  });

  it('ignores non-positive steps', () => {
    expect(createCounter({ step: 0 }).step).toBe(1);
    expect(createCounter({ step: -3 }).step).toBe(1);
    expect(createCounter({ step: 2.5 }).step).toBe(2.5);
  });
});

describe('sanitizeCounter', () => {
  it('rejects things that are not counters', () => {
    expect(sanitizeCounter(null)).toBeNull();
    expect(sanitizeCounter('hello')).toBeNull();
    expect(sanitizeCounter([1, 2])).toBeNull();
  });

  it('repairs invalid fields instead of trusting them', () => {
    const c = sanitizeCounter({
      id: 'abc',
      name: 'x'.repeat(500),
      mode: 'bogus',
      color: 'javascript:alert(1)',
      value: 'NaN',
      step: -4,
      min: 10,
      max: 2,
      cardStyle: 'weird',
      players: [{ name: 5 }, 'nope'],
    });
    expect(c).toBeTruthy();
    expect(c!.id).toBe('abc');
    expect(c!.name.length).toBe(80);
    expect(c!.mode).toBe('normal');
    expect(c!.color).toBe('ember');
    expect(c!.step).toBeGreaterThan(0);
    expect(c!.min).toBe(2);
    expect(c!.max).toBe(10);
    expect(c!.cardStyle).toBe('solid');
  });

  it('keeps valid counters unchanged', () => {
    const original = createCounter({ name: 'Laps', mode: 'goal', goal: 40, value: 12, color: '#336699', pinned: true });
    const clean = sanitizeCounter(JSON.parse(JSON.stringify(original)));
    expect(clean).toEqual(original);
  });
});

describe('config and snapshots', () => {
  it('round-trips a configuration into a fresh counter with new ids', () => {
    const src = createCounter({ name: 'Match', mode: 'score', value: 0 });
    src.players[0].score = 9;
    const copy = counterFromConfig(configOf(src), 'Copy');
    expect(copy.name).toBe('Copy');
    expect(copy.players).toHaveLength(2);
    expect(copy.players[0].score).toBe(0);
    expect(copy.players[0].id === src.players[0].id).toBe(false);
    expect(copy.id === src.id).toBe(false);
  });

  it('snapshots are deep copies and comparable', () => {
    const c = createCounter({ mode: 'score' });
    const snap = snapshotOf(c);
    c.players[0].score = 3;
    expect(snap.players[0].score).toBe(0);
    expect(snapshotsEqual(snap, snapOf(c))).toBe(false);
    expect(snapshotsEqual(snap, snapshotOf({ ...c, players: snap.players }))).toBe(true);
  });
});

function snapOf(c: ReturnType<typeof createCounter>) {
  return snapshotOf(c);
}
