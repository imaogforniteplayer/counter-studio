import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Counter, CounterMode } from '../../core/types';
import { clampValue } from '../../core/counter';
import { cssRgb, gradientCss, resolveColor, rgbVar } from '../../core/colors';
import { formatNumber } from '../../core/format';
import { textOnAccent } from '../../lib/theme';

/** CSS variables that recolour everything inside an element to a counter's colour. */
export function stageVars(color: string): CSSProperties {
  const { a, b } = resolveColor(color);
  return { '--accent': rgbVar(a), '--accent2': rgbVar(b), '--onaccent': rgbVar(textOnAccent(a, b)) } as CSSProperties;
}

/** Gradient tile with a readable icon colour. */
export function tileStyle(color: string): CSSProperties {
  const { a, b } = resolveColor(color);
  return { background: gradientCss(color), color: cssRgb(textOnAccent(a, b)) };
}

export function isSingleValue(mode: CounterMode): boolean {
  return mode !== 'score' && mode !== 'multi';
}

/** True when a reset would change nothing. */
export function isAtStart(c: Counter): boolean {
  if (c.mode === 'score') return c.players.every((p) => p.score === clampValue(0, c.min, c.max));
  if (c.mode === 'multi') return c.subCounters.every((s) => s.value === clampValue(0, c.min, c.max));
  return c.value === clampValue(c.startValue, c.min, c.max);
}

/** A short spoken summary for the live region. */
export function describeCounter(c: Counter): string {
  if (c.mode === 'score') return `${c.name}: ${c.players.map((p) => `${p.name} ${formatNumber(p.score)}`).join(', ')}`;
  if (c.mode === 'multi') return `${c.name}: ${c.subCounters.map((s) => `${s.name} ${formatNumber(s.value)}`).join(', ')}`;
  return `${c.name}: ${formatNumber(c.value)}`;
}

export function clampNumber(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** The window size, kept up to date, for sizing rings and numbers. */
export function useViewport(): { w: number; h: number } {
  const [size, setSize] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return size;
}
