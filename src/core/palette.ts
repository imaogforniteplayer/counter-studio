/** Search and ranking for the command palette. Pure, so it can be tested without a screen. */

export interface PaletteEntry {
  label: string;
  /** Extra words that should find this entry but are not shown. */
  keywords?: string;
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** True when every letter of `needle` appears in `hay` in order. */
function inOrder(hay: string, needle: string): boolean {
  let at = 0;
  for (const ch of needle) {
    at = hay.indexOf(ch, at);
    if (at === -1) return false;
    at += 1;
  }
  return true;
}

function tokenScore(token: string, label: string, keywords: string): number {
  const l = label.toLowerCase();
  if (l.startsWith(token)) return 100;
  if (words(label).some((w) => w.startsWith(token))) return 80;
  if (l.includes(token)) return 60;
  if (keywords.toLowerCase().includes(token)) return 30;
  if (token.length >= 3 && inOrder(l, token)) return 15;
  return 0;
}

/** 0 means no match. Every word typed has to match something, and a higher score is a better match. */
export function matchScore(query: string, entry: PaletteEntry): number {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 1;
  let total = 0;
  for (const token of tokens) {
    const s = tokenScore(token, entry.label, entry.keywords ?? '');
    if (s === 0) return 0;
    total += s;
  }
  return total;
}

/** Entries that match, best first. With nothing typed, everything comes back in its given order. */
export function rankEntries<T extends PaletteEntry>(entries: T[], query: string, limit = 50): T[] {
  if (query.trim() === '') return entries.slice(0, limit);
  return entries
    .map((entry, index) => ({ entry, index, score: matchScore(query, entry) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((r) => r.entry);
}
