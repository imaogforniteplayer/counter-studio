import { describe, expect, it } from 'vitest';
import { MAX_TIMER_MS, addLap, addTap, bpmFromTaps, formatDice, lapExtremes, pace, parseDiceNotation, randomInt, rollDice, shuffle, toMs } from './tools';

const seq = (...v: number[]) => {
  let i = 0;
  return () => v[i++ % v.length];
};

describe('randomInt', () => {
  it('covers both ends', () => {
    expect(randomInt(1, 6, () => 0)).toBe(1);
    expect(randomInt(1, 6, () => 0.999999)).toBe(6);
  });
  it('accepts reversed bounds', () => {
    expect(randomInt(6, 1, () => 0)).toBe(1);
  });
  it('handles negatives', () => {
    expect(randomInt(-3, 3, () => 0)).toBe(-3);
    expect(randomInt(-3, 3, () => 0.999)).toBe(3);
  });
});

describe('shuffle', () => {
  it('keeps every item and does not change the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffle(input, seq(0.1, 0.7, 0.3, 0.9));
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('dice', () => {
  it('parses notation', () => {
    expect(parseDiceNotation('2d6+3')).toEqual({ count: 2, sides: 6, modifier: 3 });
    expect(parseDiceNotation('d20')).toEqual({ count: 1, sides: 20, modifier: 0 });
    expect(parseDiceNotation(' 4D8 - 1 ')).toEqual({ count: 4, sides: 8, modifier: -1 });
  });
  it('rejects nonsense and extremes', () => {
    expect(parseDiceNotation('hello')).toBeNull();
    expect(parseDiceNotation('0d6')).toBeNull();
    expect(parseDiceNotation('2d1')).toBeNull();
    expect(parseDiceNotation('999d6')).toBeNull();
    expect(parseDiceNotation('2d6+')).toBeNull();
  });
  it('rolls and adds the modifier', () => {
    const r = rollDice({ count: 3, sides: 6, modifier: 2 }, seq(0, 0.5, 0.999));
    expect(r.rolls).toEqual([1, 4, 6]);
    expect(r.total).toBe(13);
  });
  it('formats', () => {
    expect(formatDice({ count: 2, sides: 6, modifier: 3 })).toBe('2d6+3');
    expect(formatDice({ count: 1, sides: 20, modifier: -2 })).toBe('1d20-2');
    expect(formatDice({ count: 1, sides: 20, modifier: 0 })).toBe('1d20');
  });
});

describe('tap tempo', () => {
  it('needs two taps', () => {
    expect(bpmFromTaps([])).toBeNull();
    expect(bpmFromTaps([1000])).toBeNull();
  });
  it('computes 120 bpm from 500 ms gaps', () => {
    expect(bpmFromTaps([0, 500, 1000, 1500])).toBe(120);
  });
  it('restarts after a long pause', () => {
    expect(addTap([0, 500], 10_000)).toEqual([10_000]);
    expect(addTap([0, 500], 1000)).toEqual([0, 500, 1000]);
  });
});

describe('pace', () => {
  const day = 86_400_000;
  it('works out a daily rate', () => {
    const p = pace(100, 30, 10 * day, 0);
    expect(p.remaining).toBe(70);
    expect(p.daysLeft).toBe(10);
    expect(p.perDay).toBe(7);
    expect(p.perWeek).toBe(49);
  });
  it('reports done and overdue', () => {
    expect(pace(10, 10, day, 0).done).toBe(true);
    const late = pace(10, 2, -1, 0);
    expect(late.overdue).toBe(true);
    expect(late.perDay).toBeNull();
  });
});

describe('timer input and laps', () => {
  it('converts and clamps', () => {
    expect(toMs(0, 1, 30)).toBe(90_000);
    expect(toMs(-5, NaN, 10)).toBe(10_000);
    expect(toMs(500, 0, 0)).toBe(MAX_TIMER_MS);
  });
  it('records laps with splits', () => {
    let laps = addLap([], 1000);
    laps = addLap(laps, 3500);
    laps = addLap(laps, 4000);
    expect(laps.map((l) => l.split)).toEqual([1000, 2500, 500]);
    expect(lapExtremes(laps)).toEqual({ fastest: 3, slowest: 2 });
    expect(lapExtremes(laps.slice(0, 1))).toEqual({ fastest: null, slowest: null });
  });
});
