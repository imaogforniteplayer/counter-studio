import type { Counter } from './types';

/** Live counters in manual order: pinned first, then the arranged order, then newest first. */
export function manualOrder(all: Counter[]): Counter[] {
  return all
    .filter((c) => c.deletedAt === null)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.order !== b.order) return a.order - b.order;
      return b.createdAt - a.createdAt;
    });
}

/**
 * Give a visible subset of counters a new order without disturbing the rest.
 *
 * `all` is every counter; trashed ones are ignored. `visibleIdsInNewOrder` is the
 * subset the person is looking at (a folder, say) in the order they want. The
 * result is the full list of live counter ids in manual order, where the visible
 * counters keep occupying the same slots they did before, only reshuffled.
 *
 * Pinned counters always sort first, so a counter can only be moved within its
 * own pinned or unpinned group. A move that would carry a counter across that
 * boundary is ignored and the current order is returned unchanged.
 */
export function reorderWithin(all: Counter[], visibleIdsInNewOrder: string[]): string[] {
  const ordered = manualOrder(all);
  const ids = ordered.map((c) => c.id);
  const known = new Set(ids);

  const seen = new Set<string>();
  const wanted: string[] = [];
  for (const id of visibleIdsInNewOrder) {
    if (known.has(id) && !seen.has(id)) {
      seen.add(id);
      wanted.push(id);
    }
  }
  if (wanted.length < 2) return ids;

  const slots: number[] = [];
  ids.forEach((id, index) => {
    if (seen.has(id)) slots.push(index);
  });

  const pinned = new Map(ordered.map((c) => [c.id, c.pinned]));
  const result = [...ids];
  for (let k = 0; k < slots.length; k++) {
    if (pinned.get(ids[slots[k]]) !== pinned.get(wanted[k])) return ids;
    result[slots[k]] = wanted[k];
  }
  return result;
}
