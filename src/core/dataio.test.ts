import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from './types';
import { backupHash, createBackup, hashString, ImportError, mergeBackup, parseBackup, stableStringify } from './dataio';
import type { DataState } from './dataio';
import { createCounter } from './counter';
import { DEFAULT_SETTINGS } from './settings';
import { BUILTIN_TEMPLATES } from './templates';

function entry(id: string, counterId: string, at: number, over: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, counterId, at, prev: 0, next: 1, delta: 1, kind: 'inc', target: null, label: null, session: 's', reverted: false, ...over };
}

function sample(): DataState {
  const a = createCounter({ id: 'a', name: 'Alpha', value: 5, updatedAt: 100 });
  const b = createCounter({ id: 'b', name: 'Beta', mode: 'score', updatedAt: 100 });
  return {
    counters: [a, b],
    folders: [{ id: 'f1', name: 'Work', color: 'lagoon', order: 0 }],
    templates: [],
    history: [entry('h1', 'a', 1000), entry('h2', 'a', 2000), entry('h3', 'b', 3000)],
    settings: { ...DEFAULT_SETTINGS },
  };
}

describe('export and import round trip', () => {
  it('restores exactly what was exported', () => {
    const data = sample();
    const text = JSON.stringify(createBackup(data, 999));
    const back = parseBackup(text);
    expect(back.counters).toEqual(data.counters);
    expect(back.folders).toEqual(data.folders);
    expect(back.history).toEqual(data.history);
    expect(back.settings).toEqual(data.settings);
    expect(back.exportedAt).toBe(999);
  });

  it('does not write built-in templates into backups', () => {
    const data = sample();
    data.templates = [...BUILTIN_TEMPLATES.slice(0, 2)];
    expect(createBackup(data).templates).toHaveLength(0);
  });
});

describe('parseBackup validation', () => {
  it('explains what is wrong with bad files', () => {
    expect(() => parseBackup('')).toThrow('empty');
    expect(() => parseBackup('not json')).toThrow('valid JSON');
    expect(() => parseBackup('{"hello":1}')).toThrow("doesn't look like");
    expect(() => parseBackup('[1,2,3]')).toThrow("doesn't look like");
    expect(() => parseBackup('{"app":"tickwell"}')).toThrow('version');
    expect(() => parseBackup('{"app":"tickwell","version":99}')).toThrow('newer version');
    expect(() => parseBackup('{"app":"other","version":1}')).toThrow(ImportError);
  });

  it('drops invalid items instead of failing the whole import', () => {
    const text = JSON.stringify({
      app: 'tickwell',
      version: 1,
      counters: [{ id: 'ok', name: 'Fine' }, 'garbage', null, { id: 'ok', name: 'Duplicate id' }],
      folders: [{ id: 'f', name: 'F' }, { nope: true }],
      history: [
        { id: 'h1', counterId: 'ok', at: 5, prev: 0, next: 1, delta: 1, kind: 'inc' },
        { id: 'h2', counterId: 'missing', at: 6, prev: 0, next: 1, delta: 1, kind: 'inc' },
        { id: 'h3', counterId: 'ok', at: 'yesterday' },
        { id: 'h1', counterId: 'ok', at: 7 },
      ],
    });
    const b = parseBackup(text);
    expect(b.counters).toHaveLength(1);
    expect(b.counters[0].name).toBe('Fine');
    expect(b.folders).toHaveLength(1);
    expect(b.history).toHaveLength(1);
    expect(b.history[0].id).toBe('h1');
  });

  it('removes folder references that do not exist', () => {
    const text = JSON.stringify({
      app: 'tickwell',
      version: 1,
      counters: [{ id: 'x', name: 'X', folderId: 'ghost' }],
    });
    expect(parseBackup(text).counters[0].folderId).toBeNull();
  });

  it('ignores scripts and unknown properties', () => {
    const text = JSON.stringify({
      app: 'tickwell',
      version: 1,
      counters: [{ id: 'x', name: 'X', evil: '<script>alert(1)</script>', __proto__: { polluted: true } }],
      settings: { theme: 'neon', backgroundImage: 'javascript:alert(1)' },
    });
    const b = parseBackup(text);
    expect('evil' in b.counters[0]).toBe(false);
    expect(b.settings.theme).toBe('dark');
    expect(b.settings.backgroundImage).toBeNull();
  });

  it('sorts history by time', () => {
    const text = JSON.stringify({
      app: 'tickwell',
      version: 1,
      counters: [{ id: 'x', name: 'X' }],
      history: [
        { id: 'late', counterId: 'x', at: 20 },
        { id: 'early', counterId: 'x', at: 10 },
      ],
    });
    expect(parseBackup(text).history.map((h) => h.id)).toEqual(['early', 'late']);
  });
});

describe('merging', () => {
  it('adds new counters and history without touching existing data', () => {
    const current = sample();
    const incoming = createBackup(
      {
        ...sample(),
        counters: [createCounter({ id: 'c', name: 'Gamma', updatedAt: 50 })],
        history: [entry('h9', 'c', 9000)],
      },
      1,
    );
    const res = mergeBackup(current, incoming);
    expect(res.addedCounters).toBe(1);
    expect(res.addedHistory).toBe(1);
    expect(res.state.counters).toHaveLength(3);
    expect(res.state.history).toHaveLength(4);
  });

  it('keeps the newer version of a counter that exists on both sides', () => {
    const current = sample();
    const incoming = createBackup(
      { ...sample(), counters: [createCounter({ id: 'a', name: 'Alpha renamed', updatedAt: 500 }), createCounter({ id: 'b', name: 'Older Beta', updatedAt: 1 })], history: [] },
      1,
    );
    const res = mergeBackup(current, incoming);
    expect(res.updatedCounters).toBe(1);
    expect(res.skippedCounters).toBe(1);
    expect(res.state.counters.find((c) => c.id === 'a')!.name).toBe('Alpha renamed');
    expect(res.state.counters.find((c) => c.id === 'b')!.name).toBe('Beta');
  });

  it('does not duplicate history that is already present', () => {
    const current = sample();
    const res = mergeBackup(current, createBackup(sample(), 1));
    expect(res.addedHistory).toBe(0);
    expect(res.state.history).toHaveLength(3);
  });
});

describe('duplicate backup detection', () => {
  it('produces the same hash for identical content regardless of key order and export time', () => {
    const data = sample();
    const a = createBackup(data, 1);
    const b = createBackup(data, 99999);
    expect(backupHash(a)).toBe(backupHash(b));
    const reordered = JSON.parse(JSON.stringify(a));
    reordered.counters = [...reordered.counters].reverse();
    expect(backupHash(reordered)).toBe(backupHash(a));
  });

  it('changes when data changes', () => {
    const data = sample();
    const before = backupHash(createBackup(data, 1));

    const edited = JSON.parse(JSON.stringify(data)) as DataState;
    edited.counters[0].value = 6;
    expect(backupHash(createBackup(edited, 1))).not.toBe(before);

    const more = JSON.parse(JSON.stringify(data)) as DataState;
    more.history.push(entry('h4', 'a', 4000));
    expect(backupHash(createBackup(more, 1))).not.toBe(before);

    const renamedFolder = JSON.parse(JSON.stringify(data)) as DataState;
    renamedFolder.folders[0].name = 'Home';
    expect(backupHash(createBackup(renamedFolder, 1))).not.toBe(before);

    const same = JSON.parse(JSON.stringify(data)) as DataState;
    expect(backupHash(createBackup(same, 1))).toBe(before);
  });

  it('hashString and stableStringify are deterministic', () => {
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    expect(stableStringify({ b: 1, a: [2, { d: 1, c: 2 }] })).toBe('{"a":[2,{"c":2,"d":1}],"b":1}');
  });
});
