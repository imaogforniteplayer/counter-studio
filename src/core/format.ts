const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 9 });

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return numberFormat.format(Object.is(n, -0) ? 0 : n);
}

/** Compact form for dense places such as chart axes: 1.2K, 3.4M. */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n * 10) / 10);
  const units: [number, string][] = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [size, suffix] of units) {
    if (abs >= size) return `${Math.round((n / size) * 10) / 10}${suffix}`;
  }
  return String(n);
}

/**
 * Parse a number typed by a person. Accepts spaces, "1,234.5" and "1.234,5" styles.
 * Returns null when the text is not a number.
 */
export function parseNumber(input: string): number | null {
  let s = input.trim().replace(/[\s  ']/g, '');
  if (!s) return null;
  const negative = s.startsWith('-') || s.startsWith('−');
  s = s.replace(/^[-+−]/, '');
  if (!/^[\d.,]+$/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot !== -1 && lastComma !== -1) {
    const decimalIsDot = lastDot > lastComma;
    s = decimalIsDot ? s.replace(/,/g, '') : s.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (lastDot !== -1) {
    if ((s.match(/\./g) || []).length > 1) {
      if (!/^\d{1,3}(\.\d{3})+$/.test(s)) return null;
      s = s.replace(/\./g, '');
    }
  }
  if (!/^\d+(\.\d+)?$|^\.\d+$/.test(s)) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function pad2(n: number): string {
  return String(Math.floor(Math.abs(n))).padStart(2, '0');
}

/** h:mm:ss (or m:ss) with optional hundredths. */
export function formatDuration(ms: number, hundredths = false): string {
  const total = Math.max(0, ms);
  const totalSeconds = Math.floor(total / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const base = h > 0 ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  if (!hundredths) return base;
  return `${base}.${pad2(Math.floor((total % 1000) / 10))}`;
}

/** Local date key, e.g. 2026-11-10. Used to group activity by calendar day. */
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(ts: number): string {
  return `${formatDate(ts)}, ${formatTime(ts)}`;
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDate(ts);
}

export function signed(n: number): string {
  const f = formatNumber(Math.abs(n));
  return n > 0 ? `+${f}` : n < 0 ? `−${f}` : f;
}
