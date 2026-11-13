import { describe, expect, it } from 'vitest';
import { dayKey, formatCompact, formatDuration, parseNumber, relativeTime, signed } from './format';

describe('parseNumber', () => {
  it('parses plain and signed integers', () => {
    expect(parseNumber('42')).toBe(42);
    expect(parseNumber('-17')).toBe(-17);
    expect(parseNumber('+8')).toBe(8);
    expect(parseNumber('  9  ')).toBe(9);
  });

  it('parses decimals', () => {
    expect(parseNumber('3.25')).toBe(3.25);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('-0.75')).toBe(-0.75);
  });

  it('understands thousands separators in both styles', () => {
    expect(parseNumber('1,234')).toBe(1234);
    expect(parseNumber('1,234,567')).toBe(1234567);
    expect(parseNumber('1,234.5')).toBe(1234.5);
    expect(parseNumber('1.234,5')).toBe(1234.5);
    expect(parseNumber('1.234.567')).toBe(1234567);
    expect(parseNumber('1 234')).toBe(1234);
  });

  it('treats a lone comma as a decimal point when it cannot be a thousands separator', () => {
    expect(parseNumber('2,5')).toBe(2.5);
    expect(parseNumber('0,25')).toBe(0.25);
  });

  it('rejects things that are not numbers', () => {
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
    expect(parseNumber('12abc')).toBeNull();
    expect(parseNumber('--5')).toBeNull();
    expect(parseNumber('1.2.3')).toBeNull();
    expect(parseNumber('e5')).toBeNull();
  });
});

describe('formatting', () => {
  it('formats durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
    expect(formatDuration(1_234, true)).toBe('0:01.23');
    expect(formatDuration(-50)).toBe('0:00');
  });

  it('formats compact numbers', () => {
    expect(formatCompact(999)).toBe('999');
    expect(formatCompact(1200)).toBe('1.2K');
    expect(formatCompact(3_400_000)).toBe('3.4M');
  });

  it('builds local day keys', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 0).getTime())).toBe('2026-12-31');
  });

  it('describes relative time', () => {
    const now = Date.now();
    expect(relativeTime(now - 2_000, now)).toBe('just now');
    expect(relativeTime(now - 90_000, now)).toBe('1m ago');
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3h ago');
    expect(relativeTime(now - 2 * 86_400_000, now)).toBe('2d ago');
  });

  it('signs deltas', () => {
    expect(signed(5).startsWith('+')).toBe(true);
    expect(signed(0)).toBe('0');
    expect(signed(-5).startsWith('−')).toBe(true);
  });
});
