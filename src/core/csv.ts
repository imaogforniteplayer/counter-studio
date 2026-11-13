import type { Counter, HistoryEntry } from './types';
import { counterTotal } from './counter';

export type Cell = string | number | boolean | null | undefined;

/** Escape one CSV cell. Text that could be run as a spreadsheet formula is defused. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  let s = v;
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv(rows: Cell[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function historyToCsv(entries: HistoryEntry[], names: Record<string, string>): string {
  const header: Cell[] = ['Date', 'Time', 'Counter', 'Change', 'Target', 'Previous', 'New', 'Delta', 'Reverted', 'Session'];
  const rows = entries.map((e): Cell[] => {
    const d = new Date(e.at);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
    return [date, time, names[e.counterId] ?? e.counterId, e.kind, e.label ?? '', e.prev, e.next, e.delta, e.reverted, e.session];
  });
  return toCsv([header, ...rows]);
}

export function countersToCsv(counters: Counter[]): string {
  const header: Cell[] = ['Name', 'Mode', 'Value', 'Start value', 'Step', 'Min', 'Max', 'Goal', 'Pinned', 'Created', 'Description'];
  const rows = counters.map((c): Cell[] => [
    c.name,
    c.mode,
    counterTotal(c),
    c.startValue,
    c.step,
    c.min,
    c.max,
    c.goal,
    c.pinned,
    new Date(c.createdAt).toISOString(),
    c.description,
  ]);
  return toCsv([header, ...rows]);
}
