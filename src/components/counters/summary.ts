import type { Counter, CounterConfig } from '../../core/types';
import { MODE_INFO, counterTotal, goalProgress } from '../../core/counter';
import { formatNumber } from '../../core/format';

export function formatInterval(ms: number): string {
  if (ms < 1000) return `${formatNumber(ms)} ms`;
  if (ms < 60_000) return `${formatNumber(ms / 1000)} s`;
  return `${formatNumber(ms / 60_000)} min`;
}

export interface ValueSummary {
  primary: string;
  secondary?: string;
  /** 0 to 1 for goals and countdowns. */
  progress?: number;
}

/** What a counter card shows as the headline value for each mode. */
export function valueSummary(c: Counter): ValueSummary {
  switch (c.mode) {
    case 'goal':
      return {
        primary: formatNumber(c.value),
        secondary: c.goal !== null ? `of ${formatNumber(c.goal)}` : undefined,
        progress: c.goal !== null && c.goal !== 0 ? goalProgress(c) : undefined,
      };
    case 'countdown':
      return { primary: formatNumber(c.value), secondary: `from ${formatNumber(c.startValue)}`, progress: goalProgress(c) };
    case 'score': {
      if (c.players.length === 0) return { primary: '0', secondary: 'No players' };
      const sorted = [...c.players].sort((x, y) => y.score - x.score);
      const total = formatNumber(counterTotal(c));
      if (sorted.length > 1 && sorted[0].score === sorted[1].score) {
        return { primary: formatNumber(sorted[0].score), secondary: `Tied · ${total} total` };
      }
      return { primary: formatNumber(sorted[0].score), secondary: `${sorted[0].name} leads · ${total} total` };
    }
    case 'multi':
      return { primary: formatNumber(counterTotal(c)), secondary: `${c.subCounters.length} ${c.subCounters.length === 1 ? 'counter' : 'counters'} · total` };
    case 'interval':
      return { primary: formatNumber(c.value), secondary: `${c.intervalDirection > 0 ? 'up' : 'down'} every ${formatInterval(c.intervalMs)}` };
    default:
      return { primary: formatNumber(c.value) };
  }
}

/** Short facts about a configuration, e.g. for template cards. */
export function describeConfig(c: CounterConfig): string[] {
  const out: string[] = [];
  if (c.mode === 'goal' && c.goal !== null) out.push(`Goal ${formatNumber(c.goal)}`);
  if (c.mode === 'countdown') out.push(`From ${formatNumber(c.startValue)}`);
  else if (c.startValue !== 0 && c.mode !== 'score' && c.mode !== 'multi') out.push(`Starts at ${formatNumber(c.startValue)}`);
  if (c.step !== 1) out.push(`Step ${formatNumber(c.step)}`);
  if (c.min !== null) out.push(`Min ${formatNumber(c.min)}`);
  if (c.max !== null) out.push(`Max ${formatNumber(c.max)}`);
  if (c.mode === 'interval') out.push(`${c.intervalDirection > 0 ? 'Up' : 'Down'} every ${formatInterval(c.intervalMs)}`);
  if (c.mode === 'score') out.push(`${c.players.length} players`);
  if (c.mode === 'multi') out.push(`${c.subCounters.length} counters`);
  return out;
}

export function modeName(mode: Counter['mode']): string {
  return MODE_INFO[mode].name;
}
