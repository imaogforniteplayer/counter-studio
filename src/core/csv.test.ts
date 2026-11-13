import { describe, expect, it } from 'vitest';
import { countersToCsv, csvCell, historyToCsv, toCsv } from './csv';
import { createCounter } from './counter';

describe('csvCell', () => {
  it('leaves simple values alone', () => {
    expect(csvCell('hello')).toBe('hello');
    expect(csvCell(42)).toBe('42');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('quotes commas, quotes and newlines', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });

  it('defuses spreadsheet formulas in text but not real negative numbers', () => {
    expect(csvCell('=SUM(A1:A9)')).toBe("'=SUM(A1:A9)");
    expect(csvCell('+1 555')).toBe("'+1 555");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(-5)).toBe('-5');
  });

  it('drops non-finite numbers', () => {
    expect(csvCell(Number.NaN)).toBe('');
  });
});

describe('csv documents', () => {
  it('joins rows with CRLF', () => {
    expect(toCsv([['a', 'b'], [1, 2]])).toBe('a,b\r\n1,2\r\n');
  });

  it('exports history with counter names', () => {
    const at = new Date(2026, 10, 10, 9, 5, 7).getTime();
    const csv = historyToCsv(
      [{ id: 'h1', counterId: 'c1', at, prev: 1, next: 2, delta: 1, kind: 'inc', target: null, label: null, session: 's', reverted: false }],
      { c1: 'Laps, outdoor' },
    );
    const lines = csv.trim().split('\r\n');
    expect(lines[0].startsWith('Date,Time,Counter')).toBe(true);
    expect(lines[1]).toBe('2026-11-10,09:05:07,"Laps, outdoor",inc,,1,2,1,false,s');
  });

  it('exports a counter summary', () => {
    const csv = countersToCsv([createCounter({ name: 'Steps', value: 12, mode: 'goal', goal: 50 })]);
    const lines = csv.trim().split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1].startsWith('Steps,goal,12,')).toBe(true);
  });
});
