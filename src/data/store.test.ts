import { describe, expect, it } from 'vitest';
import { Store, canRevertEntry } from './store';
import { createMemoryAdapter, compressOps } from './db';
import type { Op } from './db';
import { createBackup, parseBackup } from '../core/dataio';
import { BUILTIN_TEMPLATES } from '../core/templates';
import { counterFromConfig } from '../core/counter';

async function makeStore(adapter = createMemoryAdapter(), start = 1_700_000_000_000, autoBackup = false) {
  let t = start;
  const store = new Store(adapter, { now: () => t, autoBackup, flushDelayMs: 0 });
  await store.init();
  return {
    store,
    adapter,
    tick: (ms = 1000) => {
      t += ms;
      return t;
    },
    now: () => t,
  };
}

const live = (s: Store) => s.getState().counters.filter((c) => c.deletedAt === null);

describe('counting', () => {
  it('increments and decrements by the step and records history', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ name: 'Visitors', step: 2 });
    store.bump(c.id, 1);
    store.bump(c.id, 1);
    store.bump(c.id, -1);
    expect(store.getCounter(c.id)!.value).toBe(2);
    const h = store.getState().history;
    expect(h).toHaveLength(3);
    expect(h.map((e) => [e.prev, e.next, e.delta, e.kind])).toEqual([
      [0, 2, 2, 'inc'],
      [2, 4, 2, 'inc'],
      [4, 2, -2, 'dec'],
    ]);
  });

  it('supports custom amounts and quick increments', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1, 100);
    store.bump(c.id, 1, 5);
    store.bump(c.id, -1, 10);
    expect(store.getCounter(c.id)!.value).toBe(95);
  });

  it('refuses invalid amounts', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    expect(store.bump(c.id, 1, 0)).toBeNull();
    expect(store.bump(c.id, 1, -3)).toBeNull();
    expect(store.bump(c.id, 1, Number.NaN)).toBeNull();
    expect(store.getState().history).toHaveLength(0);
  });

  it('respects limits without logging empty changes', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ min: 0, max: 3 });
    store.bump(c.id, -1);
    expect(store.getState().history).toHaveLength(0);
    store.bump(c.id, 1, 2);
    const r = store.bump(c.id, 1, 5)!;
    expect(r.hit).toBe('max');
    expect(r.delta).toBe(1);
    expect(store.getCounter(c.id)!.value).toBe(3);
    const r2 = store.bump(c.id, 1)!;
    expect(r2.delta).toBe(0);
    expect(r2.hit).toBe('max');
    expect(store.getState().history).toHaveLength(2);
  });

  it('sets an exact value and clamps it', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ min: 0, max: 50 });
    const r = store.setValue(c.id, 75)!;
    expect(r.value).toBe(50);
    expect(r.hit).toBe('max');
    store.setValue(c.id, 20);
    expect(store.getCounter(c.id)!.value).toBe(20);
    expect(store.setValue(c.id, 20)!.delta).toBe(0);
    expect(store.setValue(c.id, Number.NaN)).toBeNull();
    expect(store.getState().history.map((h) => h.kind)).toEqual(['set', 'set']);
  });

  it('counts down in countdown mode and records one finish event', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'countdown', startValue: 2 });
    expect(store.getCounter(c.id)!.value).toBe(2);
    store.bump(c.id, -1);
    const r = store.bump(c.id, -1)!;
    expect(r.completed).toBe(true);
    expect(store.bump(c.id, -1)!.delta).toBe(0);
    const goals = store.getState().history.filter((h) => h.kind === 'goal');
    expect(goals).toHaveLength(1);
    expect(goals[0].label).toBe('Countdown finished');
  });

  it('records goal completion exactly once per crossing', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'goal', goal: 3 });
    store.bump(c.id, 1);
    store.bump(c.id, 1);
    expect(store.bump(c.id, 1)!.completed).toBe(true);
    expect(store.bump(c.id, 1)!.completed).toBe(false);
    store.bump(c.id, -1, 2);
    expect(store.bump(c.id, 1)!.completed).toBe(true);
    expect(store.getState().history.filter((h) => h.kind === 'goal')).toHaveLength(2);
  });

  it('resets to the starting value', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ startValue: 5 });
    store.bump(c.id, 1, 10);
    expect(store.reset(c.id)).toBe(true);
    expect(store.getCounter(c.id)!.value).toBe(5);
    expect(store.reset(c.id)).toBe(false);
    expect(store.getState().history.slice(-1)[0].kind).toBe('reset');
  });

  it('does nothing for trashed or unknown counters', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.trashCounter(c.id);
    expect(store.bump(c.id, 1)).toBeNull();
    expect(store.bump('nope', 1)).toBeNull();
    expect(store.setValue(c.id, 4)).toBeNull();
  });
});

describe('scores and multi counters', () => {
  it('changes individual player scores independently', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'score' });
    const [a, b] = store.getCounter(c.id)!.players;
    store.bumpTarget(c.id, a.id, 1, 3);
    store.bumpTarget(c.id, b.id, 1);
    store.bumpTarget(c.id, a.id, -1);
    const players = store.getCounter(c.id)!.players;
    expect(players.map((p) => p.score)).toEqual([2, 1]);
    const h = store.getState().history;
    expect(h[0].target).toBe(a.id);
    expect(h[0].label).toBe(a.name);
  });

  it('keeps sub counters independent and resets them all', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'multi', min: 0 });
    const subs = store.getCounter(c.id)!.subCounters;
    store.bumpTarget(c.id, subs[0].id, 1, 4);
    store.bumpTarget(c.id, subs[2].id, 1, 9);
    store.bumpTarget(c.id, subs[1].id, -1);
    expect(store.getCounter(c.id)!.subCounters.map((s) => s.value)).toEqual([4, 0, 9]);
    store.reset(c.id);
    expect(store.getCounter(c.id)!.subCounters.map((s) => s.value)).toEqual([0, 0, 0]);
  });

  it('sets a score directly and ignores unknown targets', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'score' });
    const p = store.getCounter(c.id)!.players[0];
    store.setTargetValue(c.id, p.id, 21);
    expect(store.getCounter(c.id)!.players[0].score).toBe(21);
    expect(store.bumpTarget(c.id, 'ghost', 1)).toBeNull();
    expect(store.setTargetValue(c.id, 'ghost', 5)).toBeNull();
  });
});

describe('undo and redo', () => {
  it('undoes and redoes value changes', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1);
    store.bump(c.id, 1);
    store.bump(c.id, 1);
    expect(store.getState().undo[c.id]).toEqual({ undo: true, redo: false });
    store.undo(c.id);
    store.undo(c.id);
    expect(store.getCounter(c.id)!.value).toBe(1);
    expect(store.getState().undo[c.id]).toEqual({ undo: true, redo: true });
    store.redo(c.id);
    expect(store.getCounter(c.id)!.value).toBe(2);
    store.redo(c.id);
    expect(store.getCounter(c.id)!.value).toBe(3);
    expect(store.redo(c.id)).toBe(false);
  });

  it('a new change after undo clears redo', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1);
    store.bump(c.id, 1);
    store.undo(c.id);
    store.bump(c.id, 1, 10);
    expect(store.getState().undo[c.id].redo).toBe(false);
    expect(store.getCounter(c.id)!.value).toBe(11);
  });

  it('can undo resets, set-values and score changes', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ startValue: 0 });
    store.setValue(c.id, 40);
    store.reset(c.id);
    store.undo(c.id);
    expect(store.getCounter(c.id)!.value).toBe(40);
    store.undo(c.id);
    expect(store.getCounter(c.id)!.value).toBe(0);

    const s = store.addCounter({ mode: 'score' });
    const p = store.getCounter(s.id)!.players[1];
    store.bumpTarget(s.id, p.id, 1, 7);
    store.undo(s.id);
    expect(store.getCounter(s.id)!.players[1].score).toBe(0);
    store.redo(s.id);
    expect(store.getCounter(s.id)!.players[1].score).toBe(7);
  });

  it('records undo and redo in the history so nothing is hidden', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1);
    store.undo(c.id);
    const h = store.getState().history;
    expect(h).toHaveLength(2);
    expect(h[1].kind).toBe('undo');
    expect(h[1].delta).toBe(-1);
  });

  it('keeps separate undo stacks per counter', async () => {
    const { store } = await makeStore();
    const a = store.addCounter();
    const b = store.addCounter();
    store.bump(a.id, 1);
    store.bump(b.id, 1, 5);
    store.undo(a.id);
    expect(store.getCounter(a.id)!.value).toBe(0);
    expect(store.getCounter(b.id)!.value).toBe(5);
    expect(store.undo(b.id)).toBe(true);
    expect(store.undo(b.id)).toBe(false);
  });
});

describe('reverting a single history entry', () => {
  it('reverses one past change while keeping later ones', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1, 5);
    store.bump(c.id, 1, 3);
    const first = store.getState().history[0];
    expect(store.revertEntry(first.id)).toBe('ok');
    expect(store.getCounter(c.id)!.value).toBe(3);
    const marked = store.getState().history.find((h) => h.id === first.id)!;
    expect(marked.reverted).toBe(true);
    expect(store.revertEntry(first.id)).toBe('unavailable');
  });

  it('is blocked when limits would be violated', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ min: 0 });
    store.bump(c.id, 1, 5);
    store.bump(c.id, -1, 5);
    const incEntry = store.getState().history[0];
    expect(store.revertEntry(incEntry.id)).toBe('blocked');
  });

  it('only allows reverting normal changes of live counters', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'goal', goal: 1 });
    store.bump(c.id, 1);
    store.undo(c.id);
    const [inc, goal, undone] = store.getState().history;
    const counters = store.getState().counters;
    expect(canRevertEntry(inc, counters)).toBe(true);
    expect(canRevertEntry(goal, counters)).toBe(false);
    expect(canRevertEntry(undone, counters)).toBe(false);
    store.trashCounter(c.id);
    expect(canRevertEntry(inc, store.getState().counters)).toBe(false);
  });

  it('reverts a score change for the right player', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ mode: 'score' });
    const [a, b] = store.getCounter(c.id)!.players;
    store.bumpTarget(c.id, a.id, 1, 4);
    store.bumpTarget(c.id, b.id, 1, 2);
    store.revertEntry(store.getState().history[0].id);
    expect(store.getCounter(c.id)!.players.map((p) => p.score)).toEqual([0, 2]);
  });
});

describe('managing counters', () => {
  it('trashes, restores and permanently deletes with history', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ name: 'Temp' });
    store.bump(c.id, 1);
    store.trashCounter(c.id);
    expect(live(store)).toHaveLength(0);
    expect(store.getState().counters).toHaveLength(1);
    store.restoreCounter(c.id);
    expect(live(store)).toHaveLength(1);
    expect(store.getState().history).toHaveLength(1);
    store.trashCounter(c.id);
    expect(store.emptyTrash()).toBe(1);
    expect(store.getState().counters).toHaveLength(0);
    expect(store.getState().history).toHaveLength(0);
  });

  it('duplicates a counter with fresh ids and no history', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ name: 'Match', mode: 'score' });
    const p = store.getCounter(c.id)!.players[0];
    store.bumpTarget(c.id, p.id, 1, 3);
    const copy = store.duplicateCounter(c.id)!;
    expect(copy.name).toBe('Match (copy)');
    expect(copy.id === c.id).toBe(false);
    expect(copy.players[0].id === p.id).toBe(false);
    expect(copy.players[0].score).toBe(3);
    expect(store.getState().history.filter((h) => h.counterId === copy.id)).toHaveLength(0);
  });

  it('edits settings and clamps values to new limits with a history note', async () => {
    const { store } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1, 50);
    store.updateCounter(c.id, { max: 10, name: '  Renamed  ', color: 'not-a-colour', step: -4 });
    const u = store.getCounter(c.id)!;
    expect(u.value).toBe(10);
    expect(u.name).toBe('Renamed');
    expect(u.color).toBe('ember');
    expect(u.step).toBe(1);
    const last = store.getState().history.slice(-1)[0];
    expect(last.label).toBe('Limits changed');
    expect(last.delta).toBe(-40);
  });

  it('pins, filters into folders and reorders', async () => {
    const { store } = await makeStore();
    const a = store.addCounter({ name: 'A' });
    const b = store.addCounter({ name: 'B' });
    const c = store.addCounter({ name: 'C' });
    expect(store.togglePin(a.id)).toBe(true);
    expect(store.togglePin(a.id)).toBe(false);
    const f = store.addFolder('Work', 'lagoon');
    store.moveToFolder(b.id, f.id);
    store.moveToFolder(c.id, 'missing-folder');
    expect(store.getCounter(b.id)!.folderId).toBe(f.id);
    expect(store.getCounter(c.id)!.folderId).toBeNull();
    store.reorder([a.id, c.id, b.id]);
    const sorted = [...live(store)].sort((x, y) => x.order - y.order).map((x) => x.name);
    expect(sorted).toEqual(['A', 'C', 'B']);
    store.deleteFolder(f.id);
    expect(store.getCounter(b.id)!.folderId).toBeNull();
    expect(store.getState().folders).toHaveLength(0);
  });

  it('puts new counters first', async () => {
    const { store } = await makeStore();
    const a = store.addCounter({ name: 'A' });
    const b = store.addCounter({ name: 'B' });
    expect(store.getCounter(b.id)!.order < store.getCounter(a.id)!.order).toBe(true);
  });

  it('selects the counter shown on Home', async () => {
    const { store } = await makeStore();
    const a = store.addCounter();
    store.selectCounter(a.id);
    expect(store.getState().settings.lastCounterId).toBe(a.id);
    store.trashCounter(a.id);
    expect(store.getState().settings.lastCounterId).toBeNull();
  });

  it('saves and removes user templates', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ name: 'Laps', mode: 'goal', goal: 12, value: 5 });
    const t = store.saveTemplate(c.id, 'Lap goal')!;
    expect(store.getState().templates).toHaveLength(1);
    const again = counterFromConfig(t.config, 'New laps');
    expect(again.goal).toBe(12);
    expect(again.value).toBe(0);
    store.deleteTemplate(t.id);
    expect(store.getState().templates).toHaveLength(0);
  });
});

describe('history management', () => {
  it('clears history for one counter or all and keeps the values', async () => {
    const { store } = await makeStore();
    const a = store.addCounter();
    const b = store.addCounter();
    store.bump(a.id, 1);
    store.bump(b.id, 1);
    store.bump(b.id, 1);
    expect(store.clearHistory(b.id)).toBe(2);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getCounter(b.id)!.value).toBe(2);
    expect(store.clearHistory()).toBe(1);
    expect(store.getState().history).toHaveLength(0);
    expect(store.clearHistory()).toBe(0);
  });

  it('starts a new session after a long pause', async () => {
    const { store, tick } = await makeStore();
    const c = store.addCounter();
    store.bump(c.id, 1);
    tick(5 * 60_000);
    store.bump(c.id, 1);
    tick(2 * 3_600_000);
    store.bump(c.id, 1);
    const sessions = store.getState().history.map((h) => h.session);
    expect(sessions[0]).toBe(sessions[1]);
    expect(sessions[2] === sessions[0]).toBe(false);
  });
});

describe('persistence', () => {
  it('saves automatically and loads the same data in a new store', async () => {
    const adapter = createMemoryAdapter();
    const one = await makeStore(adapter);
    const c = one.store.addCounter({ name: 'Persisted', mode: 'goal', goal: 9 });
    one.store.bump(c.id, 1, 4);
    one.store.updateSettings({ theme: 'light', compact: true, quickAmounts: [2, 4, 8] });
    one.store.addFolder('Home');
    await one.store.flush();
    expect(one.store.getState().saveStatus).toBe('saved');

    const two = await makeStore(adapter);
    const loaded = two.store.getCounter(c.id)!;
    expect(loaded.name).toBe('Persisted');
    expect(loaded.value).toBe(4);
    expect(two.store.getState().history).toHaveLength(1);
    expect(two.store.getState().settings.theme).toBe('light');
    expect(two.store.getState().settings.compact).toBe(true);
    expect(two.store.getState().settings.quickAmounts).toEqual([2, 4, 8]);
    expect(two.store.getState().folders).toHaveLength(1);
  });

  it('persists deletions', async () => {
    const adapter = createMemoryAdapter();
    const one = await makeStore(adapter);
    const c = one.store.addCounter();
    one.store.bump(c.id, 1);
    await one.store.flush();
    one.store.trashCounter(c.id);
    one.store.deleteForever(c.id);
    await one.store.flush();
    const two = await makeStore(adapter);
    expect(two.store.getState().counters).toHaveLength(0);
    expect(two.store.getState().history).toHaveLength(0);
  });

  it('repairs corrupt stored records instead of crashing', async () => {
    const adapter = createMemoryAdapter({
      counters: [{ id: 'ok', name: 'Fine' }, { id: 'bad', mode: 'zzz', value: 'x', color: 5 }, 'junk'],
      history: [{ id: 'h', counterId: 'ok', at: 1, prev: 0, next: 1, delta: 1, kind: 'inc' }, { id: 'orphan', counterId: 'gone', at: 2 }],
      meta: { settings: { theme: 'neon', soundVolume: 99 } },
    });
    const { store } = await makeStore(adapter);
    expect(store.getState().loadError).toBeNull();
    expect(store.getState().counters).toHaveLength(2);
    expect(store.getState().history).toHaveLength(1);
    expect(store.getState().settings.theme).toBe('dark');
    expect(store.getState().settings.soundVolume).toBe(1);
  });

  it('reports a write failure instead of silently losing data', async () => {
    const adapter = createMemoryAdapter();
    const messages: string[] = [];
    const { store } = await makeStore(adapter);
    store.onMessage = (m) => messages.push(m);
    adapter.apply = async () => {
      throw new Error('disk full');
    };
    store.addCounter();
    await store.flush();
    expect(store.getState().saveStatus).toBe('error');
    expect(messages[0]).toContain('disk full');
  });

  it('collapses repeated writes to the same record', () => {
    const ops: Op[] = [
      { type: 'put', store: 'counters', key: 'a', value: { id: 'a', v: 1 } },
      { type: 'put', store: 'counters', key: 'a', value: { id: 'a', v: 2 } },
      { type: 'put', store: 'counters', key: 'b', value: { id: 'b', v: 1 } },
      { type: 'delete', store: 'counters', key: 'b' },
      { type: 'clear', store: 'history' },
      { type: 'put', store: 'history', key: 'h1', value: { id: 'h1' } },
    ];
    const out = compressOps(ops);
    expect(out).toHaveLength(4);
    expect(out[0]).toEqual({ type: 'put', store: 'counters', key: 'a', value: { id: 'a', v: 2 } });
    expect(out[1]).toEqual({ type: 'delete', store: 'counters', key: 'b' });
  });
});

describe('export, import and restore points', () => {
  it('exports and replaces data from a backup file', async () => {
    const a = await makeStore();
    const c = a.store.addCounter({ name: 'Original' });
    a.store.bump(c.id, 1, 7);
    const text = JSON.stringify(a.store.exportBackup());

    const b = await makeStore();
    b.store.addCounter({ name: 'Other' });
    const summary = await b.store.importBackup(parseBackup(text), 'replace');
    expect(summary.counters).toBe(1);
    expect(live(b.store).map((x) => x.name)).toEqual(['Original']);
    expect(b.store.getState().history).toHaveLength(1);
    expect(b.store.getState().backups.length).toBeGreaterThan(0);
  });

  it('merges a backup without losing existing counters', async () => {
    const a = await makeStore();
    a.store.addCounter({ name: 'FromBackup' });
    const backup = parseBackup(JSON.stringify(a.store.exportBackup()));
    const b = await makeStore();
    b.store.addCounter({ name: 'Mine' });
    const s = await b.store.importBackup(backup, 'merge');
    expect(s.addedCounters).toBe(1);
    expect(live(b.store).map((x) => x.name).sort()).toEqual(['FromBackup', 'Mine']);
    // importing the same file again changes nothing
    const again = await b.store.importBackup(backup, 'merge');
    expect(again.addedCounters).toBe(0);
    expect(live(b.store)).toHaveLength(2);
  });

  it('never stores two identical restore points', async () => {
    const { store } = await makeStore();
    store.addCounter({ name: 'X' });
    expect(await store.createRestorePoint('one')).toBe('created');
    expect(await store.createRestorePoint('two')).toBe('duplicate');
    expect(store.getState().backups).toHaveLength(1);
    store.addCounter({ name: 'Y' });
    expect(await store.createRestorePoint('three')).toBe('created');
    expect(store.getState().backups).toHaveLength(2);
  });

  it('restores an earlier restore point', async () => {
    const { store } = await makeStore();
    const c = store.addCounter({ name: 'Before' });
    store.bump(c.id, 1, 3);
    await store.createRestorePoint('snap');
    const id = store.getState().backups[0].id;
    store.bump(c.id, 1, 100);
    store.addCounter({ name: 'Extra' });
    expect(await store.restoreFromPoint(id)).toBe(true);
    expect(live(store)).toHaveLength(1);
    expect(store.getCounter(c.id)!.value).toBe(3);
    expect(await store.restoreFromPoint('missing')).toBe(false);
  });

  it('keeps only the newest automatic backups', async () => {
    const { store, tick } = await makeStore();
    for (let i = 0; i < 8; i++) {
      store.addCounter({ name: `C${i}` });
      tick(1000);
      await store.createRestorePoint(`auto ${i}`, true);
    }
    expect(store.getState().backups.filter((b) => b.auto)).toHaveLength(5);
    await store.createRestorePoint('mine', false);
    expect(store.getState().backups.filter((b) => !b.auto)).toHaveLength(0);
  });

  it('deletes a restore point and can reset everything', async () => {
    const { store } = await makeStore();
    store.addCounter({ name: 'Gone soon' });
    await store.createRestorePoint('snap');
    const id = store.getState().backups[0].id;
    await store.deleteRestorePoint(id);
    expect(store.getState().backups).toHaveLength(0);

    await store.resetEverything(false);
    expect(store.getState().counters).toHaveLength(0);
    expect(store.getState().backups.length).toBe(1);
    await store.resetEverything(true);
    expect(store.getState().backups).toHaveLength(0);
  });

  it('creates an automatic daily backup on startup when due', async () => {
    const adapter = createMemoryAdapter();
    const first = await makeStore(adapter, 1_700_000_000_000, false);
    first.store.addCounter({ name: 'Daily' });
    await first.store.flush();
    const second = await makeStore(adapter, 1_700_000_000_000 + 2 * 86_400_000, true);
    await second.store.flush();
    await new Promise((r) => setTimeout(r, 20));
    expect(second.store.getState().backups).toHaveLength(1);
    expect(second.store.getState().backups[0].auto).toBe(true);
  });

  it('backup contains no built-in templates and parses cleanly', async () => {
    const { store } = await makeStore();
    store.addCounter({ name: 'T' });
    const b = createBackup({ ...store.getState(), templates: [...BUILTIN_TEMPLATES] });
    expect(b.templates).toHaveLength(0);
    expect(() => parseBackup(JSON.stringify(b))).not.toThrow();
  });
});
