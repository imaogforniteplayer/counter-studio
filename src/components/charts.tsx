import { useId, useState } from 'react';
import { formatNumber } from '../core/format';

export interface BarDatum {
  label: string;
  /** Primary value (drawn in the accent colour). */
  value: number;
  /** Optional second value drawn beside the first (for example decreases). */
  value2?: number;
  /** Longer text for the tooltip and screen readers. */
  detail?: string;
}

/** A nice round upper bound for an axis. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

/**
 * A simple bar chart drawn with SVG. Bars are keyboard-focusable, the figures are
 * also available as a table for screen readers, and colours come from the theme.
 */
export function BarChart({
  data,
  title,
  height = 200,
  legend,
  emptyText = 'Nothing to show for this period.',
}: {
  data: BarDatum[];
  title: string;
  height?: number;
  /** Names for value and value2, shown as a legend when value2 is used. */
  legend?: [string, string];
  emptyText?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [hover, setHover] = useState<number | null>(null);
  const hasSecond = data.some((d) => d.value2 !== undefined);
  const max = niceMax(Math.max(0, ...data.map((d) => Math.max(d.value, d.value2 ?? 0))));
  const total = data.reduce((s, d) => s + d.value + (d.value2 ?? 0), 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-line/20 text-sm text-muted" style={{ height }} role="img" aria-label={`${title}. ${emptyText}`}>
        {emptyText}
      </div>
    );
  }

  const W = 640;
  const padL = 34;
  const padB = 24;
  const padT = 8;
  const H = height;
  const innerW = W - padL - 4;
  const innerH = H - padB - padT;
  const slot = innerW / data.length;
  const gap = Math.min(6, slot * 0.25);
  const barW = Math.max(1.5, slot - gap);
  const sub = hasSecond ? barW / 2 : barW;
  const ticks = [0, 0.5, 1].map((t) => t * max);
  const labelEvery = Math.max(1, Math.ceil(data.length / 8));
  const y = (v: number) => padT + innerH - (v / max) * innerH;

  const active = hover !== null ? data[hover] : null;

  return (
    <figure className="m-0">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={title} focusable="false">
          <defs>
            <linearGradient id={`${uid}a`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="rgb(var(--accent))" />
              <stop offset="1" stopColor="rgb(var(--accent2))" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W - 4} y1={y(t)} y2={y(t)} stroke="rgb(var(--line) / 0.12)" strokeDasharray={t === 0 ? undefined : '3 4'} />
              <text x={padL - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="rgb(var(--muted))">
                {formatNumber(Math.round(t * 10) / 10)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x0 = padL + i * slot + gap / 2;
            const h1 = Math.max(d.value > 0 ? 2 : 0, innerH - (y(d.value) - padT));
            const h2 = d.value2 ? Math.max(2, innerH - (y(d.value2) - padT)) : 0;
            return (
              <g key={`${d.label}-${i}`} opacity={hover === null || hover === i ? 1 : 0.5}>
                <rect x={x0} y={padT + innerH - h1} width={sub} height={h1} rx={Math.min(3, sub / 2)} fill={`url(#${uid}a)`} />
                {hasSecond && h2 > 0 && <rect x={x0 + sub} y={padT + innerH - h2} width={sub} height={h2} rx={Math.min(3, sub / 2)} fill="rgb(var(--line) / 0.45)" />}
                <rect
                  x={padL + i * slot}
                  y={padT}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={d.detail ?? `${d.label}: ${formatNumber(d.value)}`}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  className="outline-none"
                />
                {i % labelEvery === 0 && (
                  <text x={padL + i * slot + slot / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="rgb(var(--muted))">
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {active && (
          <div className="pointer-events-none absolute right-1 top-0 rounded-lg border border-line/20 bg-surface px-2.5 py-1.5 text-[12.5px] shadow-soft" role="status">
            <span className="font-medium">{active.detail ?? active.label}</span>
            {!active.detail && <span className="ml-2 tabular-nums text-muted">{formatNumber(active.value)}</span>}
          </div>
        )}
      </div>
      {hasSecond && legend && (
        <figcaption className="mt-2 flex gap-4 text-[12.5px] text-muted">
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: 'linear-gradient(rgb(var(--accent)), rgb(var(--accent2)))' }} /> {legend[0]}
          </span>
          <span className="flex items-center gap-1.5">
            <i className="inline-block h-2.5 w-2.5 rounded-sm bg-line/45" /> {legend[1]}
          </span>
        </figcaption>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th>Period</th>
            <th>{legend ? legend[0] : 'Value'}</th>
            {hasSecond && <th>{legend ? legend[1] : 'Second value'}</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.label}-${i}`}>
              <td>{d.detail ?? d.label}</td>
              <td>{d.value}</td>
              {hasSecond && <td>{d.value2 ?? 0}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Horizontal share bars, one per item. */
export function ShareBars({ rows }: { rows: { label: string; value: number; color?: string }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="mb-1 flex justify-between gap-3 text-[13px]">
            <span className="truncate">{r.label}</span>
            <span className="tabular-nums text-muted">{formatNumber(r.value)}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line/10" aria-hidden="true">
            <div className="h-full rounded-full" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / max) * 100)}%`, background: r.color ?? 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)))' }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
