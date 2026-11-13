import type { HTMLAttributes, ReactNode } from 'react';
import { Minus, Pin, Plus } from 'lucide-react';
import type { Counter } from '../core/types';
import { gradientCss } from '../core/colors';
import { relativeTime } from '../core/format';
import { cx } from '../lib/cx';
import { CounterIcon } from '../lib/icons';
import { modeName, valueSummary } from './counters/summary';
import { isSingleValue, stageVars, tileStyle } from './home/shared';
import { Badge, IconButton } from './ui';

export interface CounterCardProps {
  counter: Counter;
  view?: 'grid' | 'list';
  /** Makes the card openable. Leave out for a static preview. */
  onOpen?: () => void;
  /** Quick +/- buttons for single-value counters. */
  onBump?: (direction: 1 | -1) => void;
  /** A menu or other controls shown in the corner. */
  menu?: ReactNode;
  /** Extra attributes for the card element, e.g. drag and drop handlers. */
  articleProps?: HTMLAttributes<HTMLElement>;
  className?: string;
  highlight?: boolean;
}

function styleFor(counter: Counter): { className: string; style: Record<string, string>; onGradient: boolean } {
  switch (counter.cardStyle) {
    case 'glass':
      return { className: 'glass', style: {}, onGradient: false };
    case 'outline':
      return { className: 'rounded-2xl border-2 bg-transparent', style: { borderColor: 'rgb(var(--accent) / 0.65)' }, onGradient: false };
    case 'gradient':
      return {
        className: 'rounded-2xl border border-white/15 text-onaccent shadow-soft',
        style: { background: gradientCss(counter.color, 145) },
        onGradient: true,
      };
    default:
      return { className: 'card-solid', style: {}, onGradient: false };
  }
}

/** One counter, as a card in a grid or a row in a list. Its colour is scoped to the card. */
export function CounterCard({ counter, view = 'grid', onOpen, onBump, menu, articleProps, className, highlight }: CounterCardProps) {
  const s = valueSummary(counter);
  const look = styleFor(counter);
  const sub = look.onGradient ? 'opacity-80' : 'text-muted';
  const single = isSingleValue(counter.mode) && counter.mode !== 'interval';
  const ink = look.onGradient ? 'rgb(var(--onaccent))' : undefined;

  const tile = (
    <span
      className={cx('grid shrink-0 place-items-center rounded-xl shadow-soft', view === 'grid' ? 'h-11 w-11' : 'h-10 w-10')}
      style={look.onGradient ? { background: 'rgb(0 0 0 / 0.18)', color: ink } : tileStyle(counter.color)}
    >
      <CounterIcon name={counter.icon} size={view === 'grid' ? 21 : 19} />
    </span>
  );

  const title = (
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5">
        <span className="truncate text-[15.5px] font-semibold tracking-tight">{counter.name}</span>
        {counter.pinned && <Pin size={13} className={cx('shrink-0', sub)} aria-label="Pinned" />}
      </span>
      <span className={cx('block truncate text-[12.5px]', sub)}>{counter.description || modeName(counter.mode)}</span>
    </span>
  );

  const value = (
    <span className={cx('block', view === 'list' && 'text-right')}>
      <span className="num block text-[34px] leading-none" style={{ ['--num-size' as string]: '2.1rem', color: ink }}>
        {s.primary}
      </span>
      {s.secondary && <span className={cx('mt-1 block truncate text-[12.5px]', sub)}>{s.secondary}</span>}
    </span>
  );

  const bar = s.progress !== undefined && (
    <div className={cx('h-1.5 overflow-hidden rounded-full', look.onGradient ? 'bg-black/20' : 'bg-line/15')} role="presentation">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${Math.round(s.progress * 100)}%`, background: look.onGradient ? 'rgb(var(--onaccent))' : 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)))' }}
      />
    </div>
  );

  const quick = onBump && single && (
    <div className="flex items-center gap-1">
      <IconButton label={`Subtract ${counter.step} from ${counter.name}`} size="sm" variant="secondary" icon={<Minus size={16} />} onClick={() => onBump(-1)} />
      <IconButton label={`Add ${counter.step} to ${counter.name}`} size="sm" variant="secondary" icon={<Plus size={16} />} onClick={() => onBump(1)} />
    </div>
  );

  const open = (children: ReactNode, extra?: string) =>
    onOpen ? (
      <button type="button" onClick={onOpen} aria-label={`Open ${counter.name}`} className={cx('min-w-0 rounded-xl text-left outline-offset-4', extra)}>
        {children}
      </button>
    ) : (
      <div className={cx('min-w-0', extra)}>{children}</div>
    );

  if (view === 'list') {
    return (
      <article
        {...articleProps}
        className={cx('relative flex items-center gap-3 px-4 py-3 transition-shadow', look.className, highlight && 'ring-2 ring-accent', className)}
        style={{ ...stageVars(counter.color), ...look.style }}
      >
        {open(
          <span className="flex items-center gap-3">
            {tile}
            {title}
          </span>,
          'flex-1',
        )}
        <div className="hidden w-44 shrink-0 sm:block">{open(<>{value}{bar && <span className="mt-2 block">{bar}</span>}</>, 'w-full')}</div>
        <div className="shrink-0 sm:hidden">{value}</div>
        {quick}
        {menu}
      </article>
    );
  }

  return (
    <article
      {...articleProps}
      className={cx('relative flex flex-col gap-4 p-5 transition-[transform,box-shadow] duration-200', onOpen && 'hover:-translate-y-0.5', look.className, highlight && 'ring-2 ring-accent', className)}
      style={{ ...stageVars(counter.color), ...look.style }}
    >
      <div className="flex items-start gap-3">
        {open(
          <span className="flex items-center gap-3">
            {tile}
            {title}
          </span>,
          'flex-1',
        )}
        {menu}
      </div>
      {open(
        <>
          {value}
          {bar && <span className="mt-3 block">{bar}</span>}
        </>,
      )}
      <div className="mt-auto flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2">
          <Badge>{modeName(counter.mode)}</Badge>
          <span className={cx('truncate text-[12px]', sub)}>{relativeTime(counter.lastUsedAt)}</span>
        </span>
        {quick}
      </div>
    </article>
  );
}
