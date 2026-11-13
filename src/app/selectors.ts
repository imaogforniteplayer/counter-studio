import type { Counter } from '../core/types';

/** Counters that have not been moved to the trash. */
export function liveCounters(counters: Counter[]): Counter[] {
  return counters.filter((c) => c.deletedAt === null);
}

export function trashedCounters(counters: Counter[]): Counter[] {
  return counters.filter((c) => c.deletedAt !== null).sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));
}

/** Pinned counters first, then the order the person arranged. */
export function inManualOrder(counters: Counter[]): Counter[] {
  return [...counters].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    if (a.order !== b.order) return a.order - b.order;
    return b.createdAt - a.createdAt;
  });
}

/** Most recently used first. */
export function recentlyUsed(counters: Counter[], limit = 8): Counter[] {
  return [...liveCounters(counters)].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, limit);
}

/** The counter shown on the Home screen: the remembered one, or the most recent. */
export function currentCounter(counters: Counter[], lastCounterId: string | null): Counter | null {
  const live = liveCounters(counters);
  if (live.length === 0) return null;
  return live.find((c) => c.id === lastCounterId) ?? recentlyUsed(live, 1)[0] ?? null;
}
