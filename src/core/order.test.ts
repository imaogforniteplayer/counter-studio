import { describe, expect, it } from 'vitest';
import { createCounter } from './counter';
import { manualOrder, reorderWithin } from './order';
import type { Counter } from './types';

function make(id: string, order: number, extra: Partial<Counter> = {}): Counter {
  return createCounter({ id, name: id, order, createdAt: 1000, ...extra }, 1000);
}

const four = () => [make('a', 0), make('b', 1), make('c', 2), make('d', 3)];

describe('manualOrder', () => {
  it('puts pinned first, then follows the arranged order', () => {
    const list = [make('a', 0), make('b', 1, { pinned: true }), make('c', -1)];
    expect(manualOrder(list).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks ties with the newest counter first and skips trashed ones', () => {
    const list = [make('old', 0, { createdAt: 1 }), make('new', 0, { createdAt: 5 }), make('gone', 0, { deletedAt: 9 })];
    expect(manualOrder(list).map((c) => c.id)).toEqual(['new', 'old']);
  });
});

describe('reorderWithin', () => {
  it('reverses the whole list', () => {
    expect(reorderWithin(four(), ['d', 'c', 'b', 'a'])).toEqual(['d', 'c', 'b', 'a']);
  });

  it('keeps a subset in the slots it already occupied', () => {
    expect(reorderWithin(four(), ['d', 'b'])).toEqual(['a', 'd', 'c', 'b']);
  });

  it('leaves everything alone when nothing changes', () => {
    expect(reorderWithin(four(), ['a', 'c'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ignores unknown, duplicate and trashed ids', () => {
    const list = [...four(), make('x', 4, { deletedAt: 5 })];
    expect(reorderWithin(list, ['c', 'nope', 'a', 'c', 'x'])).toEqual(['c', 'b', 'a', 'd']);
  });

  it('returns the current order for fewer than two counters', () => {
    expect(reorderWithin(four(), [])).toEqual(['a', 'b', 'c', 'd']);
    expect(reorderWithin(four(), ['c'])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('works on the order people see, not on array position', () => {
    const list = [make('a', 5), make('b', 1), make('c', 3)];
    expect(reorderWithin(list, ['c', 'b'])).toEqual(['c', 'b', 'a']);
  });

  it('allows moves inside the pinned group', () => {
    const list = [make('p1', 0, { pinned: true }), make('p2', 1, { pinned: true }), make('u', 2)];
    expect(reorderWithin(list, ['p2', 'p1'])).toEqual(['p2', 'p1', 'u']);
  });

  it('refuses to carry a counter across the pinned boundary', () => {
    const list = [make('p', 0, { pinned: true }), make('u1', 1), make('u2', 2)];
    expect(reorderWithin(list, ['u1', 'p'])).toEqual(['p', 'u1', 'u2']);
  });
});
