/** A bounded undo/redo history of immutable snapshots. */
export class UndoStack<T> {
  private past: T[] = [];
  private future: T[] = [];

  constructor(private readonly limit = 200) {}

  /** Record the state *before* a change. Making a new change clears redo. */
  push(snapshot: T): void {
    this.past.push(snapshot);
    if (this.past.length > this.limit) this.past.shift();
    this.future = [];
  }

  /** Returns the state to restore, or null when there is nothing to undo. */
  undo(current: T): T | null {
    if (this.past.length === 0) return null;
    const prev = this.past.pop() as T;
    this.future.push(current);
    return prev;
  }

  /** Returns the state to restore, or null when there is nothing to redo. */
  redo(current: T): T | null {
    if (this.future.length === 0) return null;
    const next = this.future.pop() as T;
    this.past.push(current);
    return next;
  }

  get canUndo(): boolean {
    return this.past.length > 0;
  }

  get canRedo(): boolean {
    return this.future.length > 0;
  }

  get size(): number {
    return this.past.length;
  }

  clear(): void {
    this.past = [];
    this.future = [];
  }
}
