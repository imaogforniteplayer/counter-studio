import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { formatNumber } from '../core/format';
import { tallyGroups } from '../core/counter';
import { cx } from '../lib/cx';

/**
 * Shows a number whose changed digits slide in from above (counting up) or below
 * (counting down). Unchanged digits stay still. Animation is switched off by the
 * reduced-motion setting through CSS, so nothing here needs to know about it.
 */
export function AnimatedNumber({
  value,
  className,
  format = formatNumber,
}: {
  value: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const text = format(value);
  const previous = useRef({ text, value });
  const direction = value > previous.current.value ? 'up' : value < previous.current.value ? 'down' : 'none';
  const before = Array.from(previous.current.text);
  const chars = Array.from(text);

  useEffect(() => {
    previous.current = { text, value };
  });

  return (
    <span className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {chars.map((ch, i) => {
          const fromEnd = chars.length - i;
          const was = before[before.length - fromEnd];
          const changed = direction !== 'none' && was !== ch;
          return (
            <span key={`${fromEnd}:${ch}`} className={cx('digit', changed && (direction === 'up' ? 'digit-up' : 'digit-down'))}>
              {ch === ' ' ? ' ' : ch}
            </span>
          );
        })}
      </span>
    </span>
  );
}

/** A circular progress meter. Fill colours come from the page's accent variables. */
export function ProgressRing({
  value,
  size = 240,
  stroke = 10,
  children,
  label,
  className,
}: {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
  label?: string;
  className?: string;
}) {
  const id = `ring-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div
      className={cx('relative grid place-items-center', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-label={label ?? 'Progress'}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgb(var(--accent))" />
            <stop offset="100%" stopColor="rgb(var(--accent2))" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--line) / 0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          style={{ transition: 'stroke-dashoffset 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)' }}
        />
      </svg>
      <div className="relative z-10 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * Tally marks grouped in fives. Very large counts show only the latest groups so
 * the page stays fast, with a note about how many are hidden.
 */
export function TallyMarks({ value, maxGroups = 40, className }: { value: number; maxGroups?: number; className?: string }) {
  const { groups, remainder, negative } = tallyGroups(value);
  const hidden = Math.max(0, groups - maxGroups);
  const shown = groups - hidden;
  const stroke = 'rgb(var(--accent))';
  return (
    <div className={cx('flex flex-wrap items-end justify-center gap-x-5 gap-y-4', className)} role="img" aria-label={`${formatNumber(value)} tally marks`}>
      {negative && <span className="num text-4xl text-muted">−</span>}
      {hidden > 0 && <span className="self-center text-sm text-muted">+{formatNumber(hidden)} earlier groups</span>}
      {Array.from({ length: shown }, (_, i) => (
        <svg key={i} width="56" height="64" viewBox="0 0 56 64" aria-hidden="true">
          <g stroke={stroke} strokeWidth="5" strokeLinecap="round" fill="none">
            <path d="M8 8v48" />
            <path d="M20 8v48" />
            <path d="M32 8v48" />
            <path d="M44 8v48" />
            <path d="M2 46 50 18" stroke="rgb(var(--accent2))" />
          </g>
        </svg>
      ))}
      {remainder > 0 && (
        <svg width={remainder * 12 + 4} height="64" viewBox={`0 0 ${remainder * 12 + 4} 64`} aria-hidden="true">
          <g stroke={stroke} strokeWidth="5" strokeLinecap="round" fill="none">
            {Array.from({ length: remainder }, (_, i) => (
              <path key={i} d={`M${8 + i * 12} 8v48`} />
            ))}
          </g>
        </svg>
      )}
      {groups === 0 && remainder === 0 && <span className="text-sm text-muted">No marks yet</span>}
    </div>
  );
}
