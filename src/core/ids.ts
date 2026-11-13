let fallbackCounter = 0;

/** Short unique id. Uses crypto when available, with a safe fallback. */
export function uid(prefix = ''): string {
  let rnd = '';
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      rnd = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    } else if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
      const a = new Uint8Array(8);
      crypto.getRandomValues(a);
      rnd = Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    rnd = '';
  }
  if (!rnd) {
    fallbackCounter += 1;
    rnd = Math.random().toString(36).slice(2, 10) + Date.now().toString(36) + fallbackCounter.toString(36);
  }
  return prefix ? `${prefix}_${rnd}` : rnd;
}
