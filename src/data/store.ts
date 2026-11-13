import type {
  BackupFile,
  ChangeKind,
  Counter,
  Folder,
  HistoryEntry,
  RestorePoint,
  Settings,
  Snapshot,
  Template,
} from '../core/types';
import {
  applyDelta,
  clampValue,
  configOf,
  createCounter,
  didComplete,
  normalizeLimits,
  roundNum,
  sanitizeCounter,
  snapshotOf,
} from '../core/counter';
import { isValidColor } from '../core/colors';
import { uid } from '../core/ids';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../core/settings';
import { str } from '../core/sanitize';
import { UndoStack } from '../core/undo';
import {
  backupHash,
  createBackup,
  mergeBackup,
  parseBackup,
  sanitizeFolder,
  sanitizeHistoryEntry,
  sanitizeTemplate,
} from '../core/dataio';
import type { DataState, MergeResult } from '../core/dataio';
import type { Adapter, BackupMeta, Op } from './db';
import { compressOps } from './db';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type MessageKind = 'info' | 'success' | 'error';
export type Notify = (message: string, kind?: MessageKind) => void;

export interface UndoFlags {
  undo: boolean;
  redo: boolean;
}

export interface AppState {
  ready: boolean;
  storage: 'indexeddb' | 'memory';
  saveStatus: SaveStatus;
  loadError: string | null;
  counters: Counter[];
  folders: Folder[];
  templates: Template[];
  /** Oldest first. */
  history: HistoryEntry[];
  settings: Settings;
  undo: Record<string, UndoFlags>;
  backups: BackupMeta[];
}

export interface BumpResult {
  /** The change that actually happened after limits were applied. */
  delta: number;
  hit: 'min' | 'max' | null;
  completed: boolean;
  value: number;
}

export interface StoreOptions {
  now?: () => number;
  autoBackup?: boolean;
  flushDelayMs?: number;
}

type EntryDraft = Pick<HistoryEntry, 'prev' | 'next' | 'delta' | 'kind' | 'target' | 'label'>;

const SESSION_GAP_MS = 30 * 60 * 1000;
const AUTO_BACKUP_EVERY_MS = 24 * 60 * 60 * 1000;
const MAX_AUTO_BACKUPS = 5;

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  mode: ImportMode;
  counters: number;
  addedCounters: number;
  updatedCounters: number;
  skippedCounters: number;
  addedHistory: number;
}

/** Whether a history entry can still be reverted on its own. */
export function canRevertEntry(entry: HistoryEntry, counters: Counter[]): boolean {
  if (entry.reverted || entry.delta === 0) return false;
  if (entry.kind === 'goal' || entry.kind === 'undo') return false;
  const c = counters.find((x) => x.id === entry.counterId);
  if (!c || c.deletedAt !== null) return false;
  if (entry.target === null) return true;
  return c.players.some((p) => p.id === entry.target) || c.subCounters.some((s) => s.id === entry.target);
}

export class Store {
  private state: AppState;
  private readonly listeners = new Set<() => void>();
  private pending: Op[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> = Promise.resolve();
  private readonly stacks = new Map<string, UndoStack<Snapshot>>();
  private session = { id: uid('sess'), last: 0 };
  private readonly now: () => number;
  private readonly autoBackup: boolean;
  private readonly flushDelay: number;

  /** Set by the UI to show messages (e.g. save errors) to the person. */
  onMessage: Notify = () => undefined;

  constructor(private readonly adapter: Adapter, opts: StoreOptions = {}) {
    this.now = opts.now ?? (() => Date.now());
    this.autoBackup = opts.autoBackup ?? true;
    this.flushDelay = opts.flushDelayMs ?? 120;
    this.state = {
      ready: false,
      storage: adapter.kind,
      saveStatus: 'idle',
      loadError: null,
      counters: [],
      folders: [],
      templates: [],
      history: [],
      settings: { ...DEFAULT_SETTINGS, quickAmounts: [...DEFAULT_SETTINGS.quickAmounts] },
      undo: {},
      backups: [],
    };
  }

  /* ---------- subscription ---------- */

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = (): AppState => this.state;

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /* ---------- loading ---------- */

  async init(): Promise<void> {
    try {
      const data = await this.adapter.load();
      const now = this.now();
      const counters: Counter[] = [];
      const ids = new Set<string>();
      for (const raw of data.counters) {
        const c = sanitizeCounter(raw, now);
        if (c && !ids.has(c.id)) {
          ids.add(c.id);
          counters.push(c);
        }
      }
      const folders = data.folders.map(sanitizeFolder).filter((f): f is Folder => f !== null);
      const templates = data.templates.map(sanitizeTemplate).filter((t): t is Template => t !== null);
      const history = data.history
        .map(sanitizeHistoryEntry)
        .filter((h): h is HistoryEntry => h !== null && ids.has(h.counterId))
        .sort((a, b) => a.at - b.at);
      const settings = sanitizeSettings(data.meta.settings);
      const backups = (await this.adapter.listBackups()).sort((a, b) => b.createdAt - a.createdAt);
      this.set({ ready: true, counters, folders, templates, history, settings, backups, storage: this.adapter.kind });
      if (this.autoBackup) void this.maybeAutoBackup();
    } catch (err) {
      this.set({
        ready: true,
        loadError: err instanceof Error ? err.message : 'Your saved data could not be read.',
      });
    }
  }

  private async maybeAutoBackup(): Promise<void> {
    try {
      const { counters, history, backups } = this.state;
      if (counters.length === 0 && history.length === 0) return;
      const newest = backups.length ? backups[0].createdAt : 0;
      if (this.now() - newest < AUTO_BACKUP_EVERY_MS) return;
      await this.createRestorePoint('Automatic daily backup', true);
    } catch {
      /* automatic backups are best-effort */
    }
  }

  /* ---------- persistence ---------- */

  private queue(...ops: Op[]): void {
    this.pending.push(...ops);
    if (this.state.saveStatus !== 'saving') this.set({ saveStatus: 'saving' });
    if (!this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        void this.flush();
      }, this.flushDelay);
    }
  }

  /** Write everything that is waiting to be saved. Resolves when the data is stored. */
  flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    const ops = compressOps(this.pending);
    this.pending = [];
    if (ops.length === 0) return this.inflight;
    this.inflight = this.inflight.then(async () => {
      try {
        await this.adapter.apply(ops);
        if (this.pending.length === 0) this.set({ saveStatus: 'saved' });
      } catch (err) {
        this.set({ saveStatus: 'error' });
        const why = err instanceof Error ? err.message : 'unknown error';
        this.onMessage(`Your latest changes could not be saved (${why}). Export a backup to be safe.`, 'error');
      }
    });
    return this.inflight;
  }

  private putCounter(c: Counter): Op {
    return { type: 'put', store: 'counters', key: c.id, value: c };
  }

  private putEntry(e: HistoryEntry): Op {
    return { type: 'put', store: 'history', key: e.id, value: e };
  }

  /* ---------- helpers ---------- */

  getCounter(id: string): Counter | undefined {
    return this.state.counters.find((c) => c.id === id);
  }

  private findLive(id: string): Counter | undefined {
    return this.state.counters.find((c) => c.id === id && c.deletedAt === null);
  }

  private dataState(): DataState {
    const { counters, folders, templates, history, settings } = this.state;
    return { counters, folders, templates, history, settings };
  }

  private stackFor(id: string): UndoStack<Snapshot> {
    let s = this.stacks.get(id);
    if (!s) {
      s = new UndoStack<Snapshot>();
      this.stacks.set(id, s);
    }
    return s;
  }

  private undoFlags(id: string): Record<string, UndoFlags> {
    const s = this.stacks.get(id);
    return { ...this.state.undo, [id]: { undo: !!s && s.canUndo, redo: !!s && s.canRedo } };
  }

  private sessionId(now: number): string {
    if (this.session.last === 0 || now - this.session.last > SESSION_GAP_MS) {
      this.session = { id: uid('sess'), last: now };
    } else {
      this.session.last = now;
    }
    return this.session.id;
  }

  /** Apply one change to a counter, recording history and undo state. */
  private commit(
    id: string,
    make: (c: Counter) => { next: Counter; entries: EntryDraft[] } | null,
    undoable = true,
  ): Counter | null {
    const c = this.findLive(id);
    if (!c) return null;
    const result = make(c);
    if (!result) return null;
    const now = this.now();
    if (undoable) this.stackFor(id).push(snapshotOf(c));
    const updated: Counter = { ...result.next, updatedAt: now, lastUsedAt: now };
    const session = this.sessionId(now);
    const entries: HistoryEntry[] = result.entries.map((e) => ({
      id: uid('h'),
      counterId: id,
      at: now,
      session,
      reverted: false,
      ...e,
    }));
    this.set({
      counters: this.state.counters.map((x) => (x.id === id ? updated : x)),
      history: entries.length ? [...this.state.history, ...entries] : this.state.history,
      undo: this.undoFlags(id),
    });
    this.queue(this.putCounter(updated), ...entries.map((e) => this.putEntry(e)));
    return updated;
  }

  private completionEntry(c: Counter, value: number): EntryDraft {
    return {
      prev: value,
      next: value,
      delta: 0,
      kind: 'goal',
      target: null,
      label: c.mode === 'countdown' ? 'Countdown finished' : 'Goal reached',
    };
  }

  /* ---------- counting ---------- */

  /** Add to (direction 1) or subtract from (direction -1) the main value. */
  bump(id: string, direction: 1 | -1, amount?: number, kind?: ChangeKind): BumpResult | null {
    const c = this.findLive(id);
    if (!c) return null;
    const amt = amount ?? c.step;
    if (!Number.isFinite(amt) || amt <= 0) return null;
    const out = applyDelta(c.value, direction * amt, c.min, c.max);
    if (out.delta === 0) return { delta: 0, hit: out.hit, completed: false, value: c.value };
    let completed = false;
    this.commit(id, (cur) => {
      const entries: EntryDraft[] = [
        { prev: out.prev, next: out.next, delta: out.delta, kind: kind ?? (direction > 0 ? 'inc' : 'dec'), target: null, label: null },
      ];
      if (didComplete(cur, out.prev, out.next)) {
        completed = true;
        entries.push(this.completionEntry(cur, out.next));
      }
      return { next: { ...cur, value: out.next }, entries };
    });
    return { delta: out.delta, hit: out.hit, completed, value: out.next };
  }

  /** Add to or subtract from a player's score or a sub-counter's value. */
  bumpTarget(id: string, targetId: string, direction: 1 | -1, amount?: number): BumpResult | null {
    const c = this.findLive(id);
    if (!c) return null;
    const player = c.players.find((p) => p.id === targetId);
    const sub = c.subCounters.find((s) => s.id === targetId);
    const item = player ?? sub;
    if (!item) return null;
    const current = player ? player.score : (sub as NonNullable<typeof sub>).value;
    const amt = amount ?? c.step;
    if (!Number.isFinite(amt) || amt <= 0) return null;
    const out = applyDelta(current, direction * amt, c.min, c.max);
    if (out.delta === 0) return { delta: 0, hit: out.hit, completed: false, value: current };
    this.commit(id, (cur) => ({
      next: this.withTarget(cur, targetId, out.next),
      entries: [{ prev: out.prev, next: out.next, delta: out.delta, kind: direction > 0 ? 'inc' : 'dec', target: targetId, label: item.name }],
    }));
    return { delta: out.delta, hit: out.hit, completed: false, value: out.next };
  }

  private withTarget(c: Counter, targetId: string, value: number): Counter {
    return {
      ...c,
      players: c.players.map((p) => (p.id === targetId ? { ...p, score: value } : p)),
      subCounters: c.subCounters.map((s) => (s.id === targetId ? { ...s, value } : s)),
    };
  }

  /** Type in an exact value for the main counter. */
  setValue(id: string, raw: number): BumpResult | null {
    const c = this.findLive(id);
    if (!c || !Number.isFinite(raw)) return null;
    const next = clampValue(raw, c.min, c.max);
    const hit: 'min' | 'max' | null = raw > next ? 'max' : raw < next ? 'min' : null;
    if (next === c.value) return { delta: 0, hit, completed: false, value: c.value };
    const delta = roundNum(next - c.value);
    let completed = false;
    this.commit(id, (cur) => {
      const entries: EntryDraft[] = [{ prev: cur.value, next, delta, kind: 'set', target: null, label: null }];
      if (didComplete(cur, cur.value, next)) {
        completed = true;
        entries.push(this.completionEntry(cur, next));
      }
      return { next: { ...cur, value: next }, entries };
    });
    return { delta, hit, completed, value: next };
  }

  setTargetValue(id: string, targetId: string, raw: number): BumpResult | null {
    const c = this.findLive(id);
    if (!c || !Number.isFinite(raw)) return null;
    const player = c.players.find((p) => p.id === targetId);
    const sub = c.subCounters.find((s) => s.id === targetId);
    const item = player ?? sub;
    if (!item) return null;
    const current = player ? player.score : (sub as NonNullable<typeof sub>).value;
    const next = clampValue(raw, c.min, c.max);
    if (next === current) return { delta: 0, hit: null, completed: false, value: current };
    const delta = roundNum(next - current);
    this.commit(id, (cur) => ({
      next: this.withTarget(cur, targetId, next),
      entries: [{ prev: current, next, delta, kind: 'set', target: targetId, label: item.name }],
    }));
    return { delta, hit: null, completed: false, value: next };
  }

  /** Back to the starting value (or zero for scoreboards and multi-counters). */
  reset(id: string): boolean {
    const result = this.commit(id, (c) => {
      if (c.mode === 'score' || c.mode === 'multi') {
        const zero = clampValue(0, c.min, c.max);
        const entries: EntryDraft[] = [];
        for (const p of c.players) {
          if (p.score !== zero) entries.push({ prev: p.score, next: zero, delta: roundNum(zero - p.score), kind: 'reset', target: p.id, label: p.name });
        }
        for (const s of c.subCounters) {
          if (s.value !== zero) entries.push({ prev: s.value, next: zero, delta: roundNum(zero - s.value), kind: 'reset', target: s.id, label: s.name });
        }
        if (entries.length === 0) return null;
        return {
          next: {
            ...c,
            players: c.players.map((p) => ({ ...p, score: zero })),
            subCounters: c.subCounters.map((s) => ({ ...s, value: zero })),
          },
          entries,
        };
      }
      const start = clampValue(c.startValue, c.min, c.max);
      if (start === c.value) return null;
      return {
        next: { ...c, value: start },
        entries: [{ prev: c.value, next: start, delta: roundNum(start - c.value), kind: 'reset', target: null, label: null }],
      };
    });
    return result !== null;
  }

  /* ---------- undo / redo ---------- */

  private applySnapshot(id: string, snap: Snapshot, label: string): void {
    this.commit(
      id,
      (c) => {
        const entries: EntryDraft[] = [];
        if (c.value !== snap.value) {
          entries.push({ prev: c.value, next: snap.value, delta: roundNum(snap.value - c.value), kind: 'undo', target: null, label });
        }
        const players = c.players.map((p) => {
          const s = snap.players.find((x) => x.id === p.id);
          if (!s || s.score === p.score) return p;
          entries.push({ prev: p.score, next: s.score, delta: roundNum(s.score - p.score), kind: 'undo', target: p.id, label: `${label}: ${p.name}` });
          return { ...p, score: s.score };
        });
        const subCounters = c.subCounters.map((p) => {
          const s = snap.subCounters.find((x) => x.id === p.id);
          if (!s || s.value === p.value) return p;
          entries.push({ prev: p.value, next: s.value, delta: roundNum(s.value - p.value), kind: 'undo', target: p.id, label: `${label}: ${p.name}` });
          return { ...p, value: s.value };
        });
        return { next: { ...c, value: snap.value, players, subCounters }, entries };
      },
      false,
    );
  }

  undo(id: string): boolean {
    const c = this.findLive(id);
    const stack = this.stacks.get(id);
    if (!c || !stack) return false;
    const snap = stack.undo(snapshotOf(c));
    if (!snap) return false;
    this.applySnapshot(id, snap, 'Undo');
    return true;
  }

  redo(id: string): boolean {
    const c = this.findLive(id);
    const stack = this.stacks.get(id);
    if (!c || !stack) return false;
    const snap = stack.redo(snapshotOf(c));
    if (!snap) return false;
    this.applySnapshot(id, snap, 'Redo');
    return true;
  }

  /** Undo one specific change from the history by applying its opposite. */
  revertEntry(entryId: string): 'ok' | 'unavailable' | 'blocked' {
    const entry = this.state.history.find((h) => h.id === entryId);
    if (!entry || !canRevertEntry(entry, this.state.counters)) return 'unavailable';
    const c = this.findLive(entry.counterId);
    if (!c) return 'unavailable';
    const player = entry.target ? c.players.find((p) => p.id === entry.target) : undefined;
    const sub = entry.target ? c.subCounters.find((s) => s.id === entry.target) : undefined;
    const current = entry.target === null ? c.value : player ? player.score : sub ? sub.value : null;
    if (current === null) return 'unavailable';
    const out = applyDelta(current, -entry.delta, c.min, c.max);
    if (out.delta === 0) return 'blocked';
    this.commit(c.id, (cur) => ({
      next: entry.target === null ? { ...cur, value: out.next } : this.withTarget(cur, entry.target, out.next),
      entries: [{ prev: out.prev, next: out.next, delta: out.delta, kind: 'undo', target: entry.target, label: 'Reverted a change' }],
    }));
    const marked = { ...entry, reverted: true };
    this.set({ history: this.state.history.map((h) => (h.id === entry.id ? marked : h)) });
    this.queue(this.putEntry(marked));
    return 'ok';
  }

  /* ---------- counter management ---------- */

  addCounter(partial: Partial<Counter> = {}): Counter {
    const now = this.now();
    const minOrder = this.state.counters.reduce((m, c) => Math.min(m, c.order), 0);
    const c = createCounter({ cardStyle: this.state.settings.defaultCardStyle, ...partial, order: minOrder - 1 }, now);
    this.set({ counters: [...this.state.counters, c] });
    this.queue(this.putCounter(c));
    return c;
  }

  updateCounter(id: string, patch: Partial<Counter>): boolean {
    const c = this.findLive(id);
    if (!c) return false;
    const lim = normalizeLimits(patch.min !== undefined ? patch.min : c.min, patch.max !== undefined ? patch.max : c.max);
    const now = this.now();
    const step = patch.step !== undefined && Number.isFinite(patch.step) && patch.step > 0 ? patch.step : c.step;
    let next: Counter = {
      ...c,
      ...patch,
      id: c.id,
      name: patch.name !== undefined ? str(patch.name, 80).trim() || c.name : c.name,
      description: patch.description !== undefined ? str(patch.description, 500) : c.description,
      color: patch.color !== undefined && isValidColor(patch.color) ? patch.color : c.color,
      min: lim.min,
      max: lim.max,
      step,
      updatedAt: now,
    };
    next = { ...next, startValue: clampValue(next.startValue, lim.min, lim.max) };
    const entries: HistoryEntry[] = [];
    const session = this.sessionId(now);
    const clamp = (n: number) => clampValue(n, lim.min, lim.max);
    const clampedValue = clamp(next.value);
    if (clampedValue !== c.value && clampedValue !== next.value) {
      entries.push({ id: uid('h'), counterId: id, at: now, prev: next.value, next: clampedValue, delta: roundNum(clampedValue - next.value), kind: 'set', target: null, label: 'Limits changed', session, reverted: false });
    }
    next = {
      ...next,
      value: clampedValue,
      players: next.players.map((p) => ({ ...p, score: clamp(p.score) })),
      subCounters: next.subCounters.map((s) => ({ ...s, value: clamp(s.value) })),
    };
    this.set({
      counters: this.state.counters.map((x) => (x.id === id ? next : x)),
      history: entries.length ? [...this.state.history, ...entries] : this.state.history,
    });
    this.queue(this.putCounter(next), ...entries.map((e) => this.putEntry(e)));
    return true;
  }

  duplicateCounter(id: string): Counter | null {
    const c = this.findLive(id);
    if (!c) return null;
    const now = this.now();
    const minOrder = this.state.counters.reduce((m, x) => Math.min(m, x.order), 0);
    const copy: Counter = {
      ...c,
      id: uid('c'),
      name: str(`${c.name} (copy)`, 80),
      pinned: false,
      order: minOrder - 1,
      players: c.players.map((p) => ({ ...p, id: uid('p') })),
      subCounters: c.subCounters.map((s) => ({ ...s, id: uid('s') })),
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
      deletedAt: null,
    };
    this.set({ counters: [...this.state.counters, copy] });
    this.queue(this.putCounter(copy));
    return copy;
  }

  trashCounter(id: string): boolean {
    const c = this.findLive(id);
    if (!c) return false;
    const next = { ...c, deletedAt: this.now(), pinned: false };
    this.stacks.delete(id);
    const undo = { ...this.state.undo };
    delete undo[id];
    this.set({ counters: this.state.counters.map((x) => (x.id === id ? next : x)), undo });
    if (this.state.settings.lastCounterId === id) this.updateSettings({ lastCounterId: null });
    this.queue(this.putCounter(next));
    return true;
  }

  restoreCounter(id: string): boolean {
    const c = this.getCounter(id);
    if (!c || c.deletedAt === null) return false;
    const next = { ...c, deletedAt: null, updatedAt: this.now() };
    this.set({ counters: this.state.counters.map((x) => (x.id === id ? next : x)) });
    this.queue(this.putCounter(next));
    return true;
  }

  /** Permanently remove a counter and its history. */
  deleteForever(id: string): boolean {
    const c = this.getCounter(id);
    if (!c) return false;
    const removed = this.state.history.filter((h) => h.counterId === id);
    this.stacks.delete(id);
    const undo = { ...this.state.undo };
    delete undo[id];
    this.set({
      counters: this.state.counters.filter((x) => x.id !== id),
      history: this.state.history.filter((h) => h.counterId !== id),
      undo,
    });
    if (this.state.settings.lastCounterId === id) this.updateSettings({ lastCounterId: null });
    this.queue({ type: 'delete', store: 'counters', key: id }, ...removed.map((h): Op => ({ type: 'delete', store: 'history', key: h.id })));
    return true;
  }

  emptyTrash(): number {
    const trashed = this.state.counters.filter((c) => c.deletedAt !== null);
    trashed.forEach((c) => this.deleteForever(c.id));
    return trashed.length;
  }

  /** Give the listed counters the order they appear in (top to bottom). */
  reorder(orderedIds: string[]): void {
    const index = new Map(orderedIds.map((id, i) => [id, i]));
    const changed: Counter[] = [];
    const counters = this.state.counters.map((c) => {
      const i = index.get(c.id);
      if (i === undefined || c.order === i) return c;
      const next = { ...c, order: i };
      changed.push(next);
      return next;
    });
    if (changed.length === 0) return;
    this.set({ counters });
    this.queue(...changed.map((c) => this.putCounter(c)));
  }

  togglePin(id: string): boolean | null {
    const c = this.findLive(id);
    if (!c) return null;
    const next = { ...c, pinned: !c.pinned, updatedAt: this.now() };
    this.set({ counters: this.state.counters.map((x) => (x.id === id ? next : x)) });
    this.queue(this.putCounter(next));
    return next.pinned;
  }

  moveToFolder(id: string, folderId: string | null): void {
    const c = this.findLive(id);
    if (!c) return;
    if (folderId !== null && !this.state.folders.some((f) => f.id === folderId)) return;
    const next = { ...c, folderId, updatedAt: this.now() };
    this.set({ counters: this.state.counters.map((x) => (x.id === id ? next : x)) });
    this.queue(this.putCounter(next));
  }

  /** Make a counter the one shown on the Home screen. */
  selectCounter(id: string): void {
    const c = this.findLive(id);
    if (!c) return;
    const next = { ...c, lastUsedAt: this.now() };
    this.set({ counters: this.state.counters.map((x) => (x.id === id ? next : x)) });
    this.queue(this.putCounter(next));
    this.updateSettings({ lastCounterId: id });
  }

  /* ---------- folders & templates ---------- */

  addFolder(name: string, color = 'slate'): Folder {
    const order = this.state.folders.reduce((m, f) => Math.max(m, f.order), -1) + 1;
    const f: Folder = { id: uid('f'), name: str(name, 60).trim() || 'New folder', color: isValidColor(color) ? color : 'slate', order };
    this.set({ folders: [...this.state.folders, f] });
    this.queue({ type: 'put', store: 'folders', key: f.id, value: f });
    return f;
  }

  updateFolder(id: string, patch: Partial<Pick<Folder, 'name' | 'color'>>): void {
    const f = this.state.folders.find((x) => x.id === id);
    if (!f) return;
    const next: Folder = {
      ...f,
      name: patch.name !== undefined ? str(patch.name, 60).trim() || f.name : f.name,
      color: patch.color !== undefined && isValidColor(patch.color) ? patch.color : f.color,
    };
    this.set({ folders: this.state.folders.map((x) => (x.id === id ? next : x)) });
    this.queue({ type: 'put', store: 'folders', key: id, value: next });
  }

  /** Remove a folder. Its counters move back to the main list. */
  deleteFolder(id: string): void {
    if (!this.state.folders.some((f) => f.id === id)) return;
    const moved = this.state.counters.filter((c) => c.folderId === id).map((c) => ({ ...c, folderId: null }));
    const movedIds = new Set(moved.map((c) => c.id));
    this.set({
      folders: this.state.folders.filter((f) => f.id !== id),
      counters: this.state.counters.map((c) => (movedIds.has(c.id) ? { ...c, folderId: null } : c)),
    });
    this.queue({ type: 'delete', store: 'folders', key: id }, ...moved.map((c) => this.putCounter(c)));
  }

  saveTemplate(counterId: string, name: string, description = ''): Template | null {
    const c = this.getCounter(counterId);
    if (!c) return null;
    const t: Template = {
      id: uid('t'),
      name: str(name, 80).trim() || c.name,
      description: str(description, 300),
      category: 'My templates',
      builtin: false,
      createdAt: this.now(),
      config: configOf(c),
    };
    this.set({ templates: [...this.state.templates, t] });
    this.queue({ type: 'put', store: 'templates', key: t.id, value: t });
    return t;
  }

  deleteTemplate(id: string): void {
    if (!this.state.templates.some((t) => t.id === id)) return;
    this.set({ templates: this.state.templates.filter((t) => t.id !== id) });
    this.queue({ type: 'delete', store: 'templates', key: id });
  }

  /* ---------- history ---------- */

  /** Delete history for one counter, or for every counter. Counter values are kept. */
  clearHistory(counterId?: string): number {
    const doomed = counterId ? this.state.history.filter((h) => h.counterId === counterId) : this.state.history;
    if (doomed.length === 0) return 0;
    if (counterId) {
      this.set({ history: this.state.history.filter((h) => h.counterId !== counterId) });
      this.queue(...doomed.map((h): Op => ({ type: 'delete', store: 'history', key: h.id })));
    } else {
      this.set({ history: [] });
      this.queue({ type: 'clear', store: 'history' });
    }
    return doomed.length;
  }

  /* ---------- settings ---------- */

  updateSettings(patch: Partial<Settings>): void {
    const next = sanitizeSettings({ ...this.state.settings, ...patch });
    this.set({ settings: next });
    this.queue({ type: 'put', store: 'meta', key: 'settings', value: { key: 'settings', value: next } });
  }

  /* ---------- backup, import, restore ---------- */

  exportBackup(): BackupFile {
    return createBackup(this.dataState(), this.now());
  }

  /** Replace everything in memory and in storage with the given data. */
  private async replaceAll(data: DataState): Promise<void> {
    this.stacks.clear();
    this.set({
      counters: data.counters,
      folders: data.folders,
      templates: data.templates.filter((t) => !t.builtin),
      history: data.history,
      settings: data.settings,
      undo: {},
    });
    const ops: Op[] = [
      { type: 'clear', store: 'counters' },
      { type: 'clear', store: 'folders' },
      { type: 'clear', store: 'templates' },
      { type: 'clear', store: 'history' },
      ...data.counters.map((c) => this.putCounter(c)),
      ...data.folders.map((f): Op => ({ type: 'put', store: 'folders', key: f.id, value: f })),
      ...data.templates.filter((t) => !t.builtin).map((t): Op => ({ type: 'put', store: 'templates', key: t.id, value: t })),
      ...data.history.map((h) => this.putEntry(h)),
      { type: 'put', store: 'meta', key: 'settings', value: { key: 'settings', value: data.settings } },
    ];
    this.queue(...ops);
    await this.flush();
  }

  async importBackup(backup: BackupFile, mode: ImportMode): Promise<ImportSummary> {
    await this.createRestorePoint(mode === 'replace' ? 'Before replacing with import' : 'Before importing', true);
    if (mode === 'replace') {
      await this.replaceAll({
        counters: backup.counters,
        folders: backup.folders,
        templates: backup.templates,
        history: backup.history,
        settings: backup.settings,
      });
      return {
        mode,
        counters: backup.counters.length,
        addedCounters: backup.counters.length,
        updatedCounters: 0,
        skippedCounters: 0,
        addedHistory: backup.history.length,
      };
    }
    const merged: MergeResult = mergeBackup(this.dataState(), backup);
    await this.replaceAll(merged.state);
    return {
      mode,
      counters: merged.state.counters.length,
      addedCounters: merged.addedCounters,
      updatedCounters: merged.updatedCounters,
      skippedCounters: merged.skippedCounters,
      addedHistory: merged.addedHistory,
    };
  }

  /** Create a restore point inside this browser. Identical data is never stored twice. */
  async createRestorePoint(label = 'Manual backup', auto = false): Promise<'created' | 'duplicate'> {
    const data = createBackup(this.dataState(), this.now());
    const hash = backupHash(data);
    if (this.state.backups.some((b) => b.hash === hash)) return 'duplicate';
    const point: RestorePoint = {
      id: uid('b'),
      createdAt: this.now(),
      hash,
      auto,
      label,
      counterCount: data.counters.length,
      historyCount: data.history.length,
      data,
    };
    await this.adapter.apply([{ type: 'put', store: 'backups', key: point.id, value: point }]);
    const { data: _data, ...meta } = point;
    void _data;
    let backups = [meta, ...this.state.backups];
    const autos = backups.filter((b) => b.auto);
    const stale = autos.slice(MAX_AUTO_BACKUPS);
    if (stale.length) {
      await this.adapter.apply(stale.map((b): Op => ({ type: 'delete', store: 'backups', key: b.id })));
      const gone = new Set(stale.map((b) => b.id));
      backups = backups.filter((b) => !gone.has(b.id));
    }
    this.set({ backups });
    return 'created';
  }

  async getRestorePoint(id: string): Promise<RestorePoint | null> {
    return this.adapter.getBackup(id);
  }

  async restoreFromPoint(id: string): Promise<boolean> {
    const point = await this.adapter.getBackup(id);
    if (!point) return false;
    // Re-validate: never trust stored data blindly.
    const clean = parseBackup(JSON.stringify(point.data), this.now());
    await this.createRestorePoint('Before restoring a backup', true);
    await this.replaceAll({
      counters: clean.counters,
      folders: clean.folders,
      templates: clean.templates,
      history: clean.history,
      settings: clean.settings,
    });
    return true;
  }

  async deleteRestorePoint(id: string): Promise<void> {
    await this.adapter.apply([{ type: 'delete', store: 'backups', key: id }]);
    this.set({ backups: this.state.backups.filter((b) => b.id !== id) });
  }

  /** Erase all counters, history, templates and settings. */
  async resetEverything(includeBackups: boolean): Promise<void> {
    await this.createRestorePoint('Before resetting everything', true);
    await this.replaceAll({
      counters: [],
      folders: [],
      templates: [],
      history: [],
      settings: { ...DEFAULT_SETTINGS, quickAmounts: [...DEFAULT_SETTINGS.quickAmounts], onboardingDone: true },
    });
    if (includeBackups) {
      await this.adapter.apply([{ type: 'clear', store: 'backups' }]);
      this.set({ backups: [] });
    }
  }
}
