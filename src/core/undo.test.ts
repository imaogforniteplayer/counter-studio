import { describe, expect, it } from 'vitest';
import { UndoStack } from './undo';

describe('UndoStack', () => {
  it('starts empty', () => {
    const s = new UndoStack<number>();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
    expect(s.undo(1)).toBeNull();
    expect(s.redo(1)).toBeNull();
  });

  it('undoes and redoes in order', () => {
    const s = new UndoStack<number>();
    // state goes 0 -> 1 -> 2 -> 3
    s.push(0);
    s.push(1);
    s.push(2);
    let current = 3;
    current = s.undo(current)!;
    expect(current).toBe(2);
    current = s.undo(current)!;
    expect(current).toBe(1);
    current = s.redo(current)!;
    expect(current).toBe(2);
    current = s.redo(current)!;
    expect(current).toBe(3);
    expect(s.redo(current)).toBeNull();
  });

  it('clears redo history when a new change is made', () => {
    const s = new UndoStack<number>();
    s.push(0);
    s.push(1);
    const back = s.undo(2)!;
    expect(back).toBe(1);
    expect(s.canRedo).toBe(true);
    s.push(1); // new change from state 1
    expect(s.canRedo).toBe(false);
  });

  it('keeps only the most recent entries up to the limit', () => {
    const s = new UndoStack<number>(3);
    for (let i = 0; i < 10; i++) s.push(i);
    expect(s.size).toBe(3);
    let cur = 10;
    const seen: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = s.undo(cur);
      if (r === null) break;
      seen.push(r);
      cur = r;
    }
    expect(seen).toEqual([9, 8, 7]);
  });

  it('clear() forgets everything', () => {
    const s = new UndoStack<string>();
    s.push('a');
    s.clear();
    expect(s.canUndo).toBe(false);
    expect(s.canRedo).toBe(false);
  });
});
