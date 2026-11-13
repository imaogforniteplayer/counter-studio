import type { CSSProperties } from 'react';
import { Minus, Pause, Play, Plus, Trophy } from 'lucide-react';
import { useSettings, useStore, useToast } from '../../app/context';
import type { Counter } from '../../core/types';
import { completionTarget, goalProgress, primaryDirection } from '../../core/counter';
import { formatNumber } from '../../core/format';
import { cx } from '../../lib/cx';
import { ProgressRing, TallyMarks } from '../display';
import { Badge } from '../ui';
import { MODE_INFO } from '../../core/counter';
import { formatInterval } from '../counters/summary';
import type { AutoCount } from './useAutoCount';
import type { Counting } from './useCounting';
import { EditableNumber } from './EditableNumber';
import { HoldButton } from './HoldButton';
import { contentWidth, fitNumberPx } from './layout';
import { clampNumber, useViewport } from './shared';

export interface StageProps {
  counter: Counter;
  counting: Counting;
  auto: AutoCount;
  /** True in full-screen mode, where everything is drawn larger. */
  full: boolean;
}

/** Normal, countdown, goal, tally and interval counters share one layout. */
export function SingleStage({ counter: c, counting, auto, full }: StageProps) {
  const store = useStore();
  const toast = useToast();
  const settings = useSettings();
  const { w, h } = useViewport();

  const dir = primaryDirection(c.mode);
  const isInterval = c.mode === 'interval';
  const isTally = c.mode === 'tally';
  const ring = c.mode === 'goal' || c.mode === 'countdown';
  const text = formatNumber(c.value);
  const width = full ? w - 48 : contentWidth(w) - 48;
  const ringSize = ring ? clampNumber(full ? Math.min(h * 0.48, width) : Math.min(width, 340), 200, 560) : 0;
  const numPx = ring
    ? fitNumberPx(text.length, ringSize * 0.72, ringSize * 0.3, settings.numberScale)
    : fitNumberPx(text.length, width, isTally ? 96 : full ? Math.min(h * 0.34, 380) : 168, settings.numberScale);
  const btn = full ? clampNumber(Math.min(h, w) * 0.24, 140, 240) : clampNumber(width * 0.5, 132, 184);
  const sub = Math.round(btn * 0.42);
  const iconSize = Math.round(btn * 0.4);

  const commit = (n: number) => {
    const r = store.setValue(c.id, n);
    if (r && r.value !== n) toast(`Set to ${formatNumber(r.value)}, the closest value this counter allows.`);
  };

  const numberEl = (
    <EditableNumber
      value={c.value}
      onCommit={commit}
      label={c.name}
      className={cx(counting.shaking && 'shake')}
      style={{ ['--num-size' as string]: `${numPx}px` } as CSSProperties}
    />
  );

  const target = completionTarget(c);
  const progress = goalProgress(c);
  const finished = target !== null && c.value === target && (c.mode === 'goal' ? c.goal !== null && c.value >= c.goal : true);
  const remaining = target !== null ? Math.abs(target - c.value) : null;

  const status = (() => {
    if (c.mode === 'goal' && c.goal !== null) {
      return finished || c.value >= c.goal ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-good">
          <Trophy size={16} aria-hidden="true" /> Goal of {formatNumber(c.goal)} reached
        </span>
      ) : (
        <span>
          {Math.round(progress * 100)}% of {formatNumber(c.goal)} · {formatNumber(remaining ?? 0)} to go
        </span>
      );
    }
    if (c.mode === 'countdown') {
      return finished ? (
        <span className="inline-flex items-center gap-1.5 font-medium text-good">
          <Trophy size={16} aria-hidden="true" /> Countdown finished
        </span>
      ) : (
        <span>
          {formatNumber(remaining ?? 0)} to go · started at {formatNumber(c.startValue)}
        </span>
      );
    }
    if (isInterval) {
      return (
        <span>
          {auto.running ? 'Running: ' : 'Paused: '}
          {c.intervalDirection > 0 ? 'up' : 'down'} by {formatNumber(c.step)} every {formatInterval(c.intervalMs)}
        </span>
      );
    }
    return null;
  })();

  const primary = isInterval ? (
    <button
      type="button"
      aria-pressed={auto.running}
      aria-label={auto.running ? 'Pause auto-counting' : 'Start auto-counting'}
      onClick={auto.toggle}
      className="count-btn grid place-items-center"
      style={{ ['--count-size' as string]: `${btn}px` } as CSSProperties}
    >
      {auto.running ? <Pause size={iconSize} strokeWidth={2.4} aria-hidden="true" /> : <Play size={iconSize} strokeWidth={2.4} aria-hidden="true" className="translate-x-[2px]" />}
    </button>
  ) : (
    <HoldButton
      label={`${dir > 0 ? 'Add' : 'Subtract'} ${formatNumber(c.step)}`}
      action={() => counting.bump(dir)}
      onBegin={counting.begin}
      className="count-btn grid place-items-center"
      style={{ ['--count-size' as string]: `${btn}px` } as CSSProperties}
    >
      {dir > 0 ? <Plus size={iconSize} strokeWidth={2.4} aria-hidden="true" /> : <Minus size={iconSize} strokeWidth={2.4} aria-hidden="true" />}
    </HoldButton>
  );

  return (
    <div className={cx('flex flex-col items-center', full ? 'gap-8' : 'gap-6 sm:gap-8', counting.celebrating && 'celebrate')}>
      <div className="flex w-full flex-col items-center gap-1 text-center">
        <h2 className={cx('max-w-full truncate font-semibold tracking-tight', full ? 'text-2xl' : 'text-lg')}>{c.name}</h2>
        {!full && c.description && <p className="max-w-md text-sm text-muted">{c.description}</p>}
        <div className="mt-1.5">
          <Badge>{MODE_INFO[c.mode].name}</Badge>
        </div>
      </div>

      {ring ? (
        <ProgressRing value={progress} size={ringSize} stroke={Math.max(8, Math.round(ringSize / 28))} label={`${c.name} progress`}>
          {numberEl}
          {c.mode === 'goal' && c.goal !== null && <span className="mt-1 text-sm text-muted">of {formatNumber(c.goal)}</span>}
        </ProgressRing>
      ) : (
        <div className="flex w-full flex-col items-center gap-5">
          {isTally && <TallyMarks value={c.value} maxGroups={full ? 60 : 24} />}
          {numberEl}
        </div>
      )}

      {status && (
        <p className="text-center text-sm text-muted" aria-live="off">
          {status}
        </p>
      )}

      <div className="flex items-center justify-center gap-5 sm:gap-8">
        <HoldButton
          label={`${dir > 0 ? 'Subtract' : 'Add'} ${formatNumber(c.step)}`}
          action={() => counting.bump(-dir as 1 | -1)}
          onBegin={counting.begin}
          className="count-btn-secondary btn btn-secondary grid place-items-center"
          style={{ ['--sub-size' as string]: `${sub}px` } as CSSProperties}
        >
          {dir > 0 ? <Minus size={Math.round(sub * 0.4)} strokeWidth={2.4} aria-hidden="true" /> : <Plus size={Math.round(sub * 0.4)} strokeWidth={2.4} aria-hidden="true" />}
        </HoldButton>
        {primary}
        <span aria-hidden="true" className="block" style={{ width: sub }} />
      </div>
      {isInterval && <p className="max-w-xs text-center text-[12.5px] text-muted">Interval counters count while Tickwell is open on screen.</p>}
    </div>
  );
}
