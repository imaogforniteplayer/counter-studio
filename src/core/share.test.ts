import { describe, expect, it } from 'vitest';
import {
  buildShareUrl,
  buildSharePayload,
  counterFromShareToken,
  encodeShare,
  fromBase64Url,
  ShareError,
  toBase64Url,
  tokenFromHash,
} from './share';
import { createCounter } from './counter';

describe('base64url', () => {
  it('round-trips unicode', () => {
    const text = 'Zähler 🏆 — 日本語';
    expect(fromBase64Url(toBase64Url(text))).toBe(text);
  });

  it('produces url-safe output', () => {
    const t = toBase64Url('???>>>~~~');
    expect(/^[A-Za-z0-9_-]+$/.test(t)).toBe(true);
  });
});

describe('share payload privacy', () => {
  const secret = createCounter({
    id: 'private-id-123',
    name: 'Morning run',
    description: 'my private notes about knee pain',
    value: 42,
    folderId: 'folder-health',
    pinned: true,
    createdAt: 1111,
  });

  it('never includes ids, folders, pins, timestamps or history', () => {
    const json = JSON.stringify(buildSharePayload(secret, { includeValue: true, includeDescription: true }));
    expect(json.includes('private-id-123')).toBe(false);
    expect(json.includes('folder-health')).toBe(false);
    expect(json.includes('pinned')).toBe(false);
    expect(json.includes('createdAt')).toBe(false);
    expect(json.includes('1111')).toBe(false);
    expect(json.includes('history')).toBe(false);
  });

  it('leaves out the description unless asked', () => {
    const p = buildSharePayload(secret, { includeValue: true, includeDescription: false });
    expect(p.description).toBeUndefined();
    expect(JSON.stringify(p).includes('knee')).toBe(false);
  });

  it('can share the value or only the starting value', () => {
    expect(buildSharePayload(secret, { includeValue: true, includeDescription: false }).value).toBe(42);
    expect(buildSharePayload(secret, { includeValue: false, includeDescription: false }).value).toBe(0);
  });

  it('hides scores when the value is not shared', () => {
    const s = createCounter({ mode: 'score' });
    s.players[0].score = 8;
    const p = buildSharePayload(s, { includeValue: false, includeDescription: false });
    expect(p.players[0].score).toBe(0);
  });
});

describe('opening a shared counter', () => {
  it('creates a new counter with a new id and the shared configuration', () => {
    const src = createCounter({ name: 'Laps', mode: 'goal', goal: 20, value: 7, step: 2, color: '#112233', min: 0 });
    const token = encodeShare(buildSharePayload(src, { includeValue: true, includeDescription: false }));
    const got = counterFromShareToken(token, 5000);
    expect(got.id === src.id).toBe(false);
    expect(got.name).toBe('Laps');
    expect(got.mode).toBe('goal');
    expect(got.goal).toBe(20);
    expect(got.value).toBe(7);
    expect(got.step).toBe(2);
    expect(got.color).toBe('#112233');
    expect(got.folderId).toBeNull();
    expect(got.pinned).toBe(false);
    expect(got.createdAt).toBe(5000);
  });

  it('keeps scoreboard players', () => {
    const src = createCounter({ mode: 'score', name: 'Final' });
    src.players[0].name = 'Reds';
    src.players[0].score = 3;
    const got = counterFromShareToken(encodeShare(buildSharePayload(src, { includeValue: true, includeDescription: false })));
    expect(got.players).toHaveLength(2);
    expect(got.players[0].name).toBe('Reds');
    expect(got.players[0].score).toBe(3);
  });

  it('rejects damaged, empty and oversized tokens with a friendly message', () => {
    expect(() => counterFromShareToken('')).toThrow('damaged');
    expect(() => counterFromShareToken('not base64 !!')).toThrow(ShareError);
    expect(() => counterFromShareToken(toBase64Url('{"oops"'))).toThrow('damaged');
    expect(() => counterFromShareToken('a'.repeat(30_000))).toThrow(ShareError);
  });

  it('rejects other versions', () => {
    expect(() => counterFromShareToken(toBase64Url(JSON.stringify({ v: 2, name: 'x' })))).toThrow('different version');
  });

  it('sanitises hostile content', () => {
    const token = toBase64Url(
      JSON.stringify({ v: 1, name: '<img src=x onerror=alert(1)>', mode: 'nope', color: 'url(evil)', value: 'big', step: -1, players: 'x' }),
    );
    const c = counterFromShareToken(token);
    expect(c.mode).toBe('normal');
    expect(c.color).toBe('ember');
    expect(c.step).toBeGreaterThan(0);
    expect(c.value).toBe(0);
  });
});

describe('share links', () => {
  it('builds a hash link and reads it back', () => {
    const c = createCounter({ name: 'Visitors', value: 3 });
    const url = buildShareUrl(c, { includeValue: true, includeDescription: false }, 'https://example.github.io/counter-studio/#/home?x=1');
    expect(url.startsWith('https://example.github.io/counter-studio/#/import?d=')).toBe(true);
    const hash = url.slice(url.indexOf('#'));
    const token = tokenFromHash(hash);
    expect(token).toBeTruthy();
    expect(counterFromShareToken(token as string).name).toBe('Visitors');
  });

  it('returns null when there is no token', () => {
    expect(tokenFromHash('#/import')).toBeNull();
    expect(tokenFromHash('#/import?x=1')).toBeNull();
  });
});
