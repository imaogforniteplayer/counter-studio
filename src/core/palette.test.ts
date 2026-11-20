import { describe, expect, it } from 'vitest';
import { matchScore, rankEntries } from './palette';

const items = [
  { label: 'Home' },
  { label: 'My Counters', keywords: 'list folders' },
  { label: 'Statistics', keywords: 'charts heatmap' },
  { label: 'Settings', keywords: 'preferences theme' },
  { label: 'New counter' },
  { label: 'Water glasses' },
];

describe('command palette search', () => {
  it('returns everything in order when nothing is typed', () => {
    expect(rankEntries(items, '')).toEqual(items);
    expect(rankEntries(items, '   ')).toEqual(items);
  });

  it('ignores case and surrounding spaces', () => {
    expect(rankEntries(items, '  STAT ').map((i) => i.label)).toEqual(['Statistics']);
  });

  it('ranks a label that starts with the text above one that only contains it', () => {
    const r = rankEntries(items, 'co').map((i) => i.label);
    expect(r[0]).toBe('My Counters'); // word start
    expect(r).toContain('New counter');
    expect(matchScore('hom', { label: 'Home' })).toBeGreaterThan(matchScore('ome', { label: 'Home' }));
  });

  it('finds entries by hidden keywords, but ranks them lower than a label match', () => {
    expect(rankEntries(items, 'heatmap').map((i) => i.label)).toEqual(['Statistics']);
    expect(rankEntries(items, 'theme').map((i) => i.label)).toEqual(['Settings']);
    expect(matchScore('settings', { label: 'Settings', keywords: 'x' })).toBeGreaterThan(matchScore('theme', { label: 'Settings', keywords: 'theme' }));
  });

  it('needs every typed word to match', () => {
    expect(rankEntries(items, 'new counter').map((i) => i.label)).toEqual(['New counter']);
    expect(rankEntries(items, 'new zebra')).toEqual([]);
  });

  it('tolerates a skipped letter for longer words', () => {
    expect(rankEntries(items, 'wgl').map((i) => i.label)).toEqual(['Water glasses']);
    expect(rankEntries(items, 'wr')).toEqual([]); // too short to guess
  });

  it('keeps the given order between equal scores and honours the limit', () => {
    const same = [{ label: 'Alpha one' }, { label: 'Alpha two' }, { label: 'Alpha three' }];
    expect(rankEntries(same, 'alpha').map((i) => i.label)).toEqual(['Alpha one', 'Alpha two', 'Alpha three']);
    expect(rankEntries(same, 'alpha', 2)).toHaveLength(2);
    expect(rankEntries(same, '', 1)).toHaveLength(1);
  });

  it('handles accents and punctuation', () => {
    expect(rankEntries([{ label: 'Café visits' }], 'café').length).toBe(1);
    expect(rankEntries([{ label: 'Push-ups (daily)' }], 'ups').length).toBe(1);
  });
});
