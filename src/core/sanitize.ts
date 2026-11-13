/** Largest absolute value a counter may hold. Keeps arithmetic exact. */
export const MAX_ABS = 1_000_000_000_000_000;

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** Trim control characters and cap the length of user-provided text. */
export function str(v: unknown, max: number, fallback = ''): string {
  if (typeof v !== 'string') return fallback;
  // eslint-disable-next-line no-control-regex
  const cleaned = v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '');
  return cleaned.slice(0, max);
}

export function num(v: unknown, fallback: number, lo = -MAX_ABS, hi = MAX_ABS): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

export function numOrNull(v: unknown, fallback: number | null = null, lo = -MAX_ABS, hi = MAX_ABS): number | null {
  if (v === null) return null;
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}

export function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}

export function oneOf<T extends string>(v: unknown, list: readonly T[], fallback: T): T {
  return typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function arr(v: unknown, max: number): unknown[] {
  return Array.isArray(v) ? v.slice(0, max) : [];
}
