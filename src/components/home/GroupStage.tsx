import type { CSSProperties } from 'react';
import { Crown, Minus, Plus } from 'lucide-react';
import { useStore, useToast } from '../../app/context';
import { newPlayer, newSubCounter } from '../../core/counter';
import { formatNumber } from '../../core/format';
import { cx } from '../../lib/cx';
import { Badge, Button } from '../ui';
import { MODE_INFO } from '../../core/counter';
import { EditableNumber } from './EditableNumber';
import { HoldButton } from './HoldButton';
import { fitNumberPx } from './layout';
import { stageVars } from './shared';
import type { StageProps } from './SingleStage';

interface Row {
  id: string;
  name: string;
  value: number;
  color: string;
}

const MAX_PLAYERS = 12;
const MAX_SUBS = 24;

/** Score counters (players or teams) and multi-counters (several counters on one screen). */
export function GroupStage({ counter: c, counting, full }: StageProps) {
  const store = useStore();
  const toast = useToast();
  const score = c.mode === 'score';
  const rows: Row[] = score
    ? c.players.map((p) => ({ id: p.id, name: p.name, value: p.score, color: p.color }))
    : c.subCounters.map((s) => ({ id: s.id, name: s.name, value: s.value, color: s.color }));

  const top = rows.reduce((m, r) => Math.max(m, r.value), Number.NEGATIVE_INFINITY);
  const leaders = score && rows.length > 1 ? rows.filter((r) => r.value === top) : [];
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  const cap = score ? MAX_PLAYERS : MAX_SUBS;
  const noun = score ? 'player' : 'counter';

  const add = () => {
    if (rows.length >= cap) {
      toast(`You can have up to ${cap} ${noun}s on one counter.`);
      return;
    }
    if (score) store.updateCounter(c.id, { players: [...c.players, newPlayer(c.players.length)] });
    else store.updateCounter(c.id, { subCounters: [...c.subCounters, newSubCounter(c.subCounters.length)] });
  };

  const big = score && rows.length <= 2;
  const maxPx = full ? (big ? 200 : 110) : big ? 96 : 64;

  return (
    <div className={cx('flex flex-col', full ? 'gap-8' : 'gap-6', counting.celebrating && 'celebrate')}>
      <div className="flex flex-col items-center gap-1 text-center">
        <h2 className={cx('max-w-full truncate font-semibold tracking-tight', full ? 'text-2xl' : 'text-lg')}>{c.name}</h2>
        {!full && c.description && <p className="max-w-md text-sm text-muted">{c.description}</p>}
        <div className="mt-1.5 flex items-center gap-2">
          <Badge>{MODE_INFO[c.mode].name}</Badge>
          <span className="text-[13px] text-muted">
            Total <span className="font-medium tabular-nums text-ink">{formatNumber(total)}</span>
          </span>
        </div>
      </div>

      <div
        className={cx(
          'grid gap-3 sm:gap-4',
          big ? 'grid-cols-1 sm:grid-cols-2' : rows.length <= 4 ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-3',
        )}
      >
        {rows.map((r) => {
          const isLeader = leaders.length === 1 && leaders[0].id === r.id;
          const text = formatNumber(r.value);
          const px = fitNumberPx(text.length, big ? 300 : 150, maxPx, 1);
          return (
            <div
              key={r.id}
              style={stageVars(r.color)}
              className={cx(
                'relative flex flex-col items-center gap-3 rounded-2xl border p-4 transition-colors sm:p-5',
                isLeader ? 'border-accent/70 bg-accent/10' : 'border-line/10 bg-raised/40',
                counting.shaking && 'shake',
              )}
            >
              <div className="flex w-full items-center justify-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))' }} aria-hidden="true" />
                <span className="truncate text-[15px] font-semibold">{r.name}</span>
                {isLeader && (
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-accent">
                    <Crown size={13} aria-hidden="true" /> Leading
                  </span>
                )}
              </div>
              <EditableNumber
                value={r.value}
                label={`${r.name} ${score ? 'score' : 'count'}`}
                style={{ ['--num-size' as string]: `${px}px` } as CSSProperties}
                onCommit={(n) => {
                  store.setTargetValue(c.id, r.id, n);
                }}
              />
              <div className="flex items-center gap-3">
                <HoldButton
                  label={`Subtract ${formatNumber(c.step)} from ${r.name}`}
                  action={() => counting.bumpTarget(r.id, -1)}
                  onBegin={counting.begin}
                  className="btn btn-secondary grid h-12 w-12 place-items-center rounded-full p-0"
                >
                  <Minus size={20} strokeWidth={2.4} aria-hidden="true" />
                </HoldButton>
                <HoldButton
                  label={`Add ${formatNumber(c.step)} to ${r.name}`}
                  action={() => counting.bumpTarget(r.id, 1)}
                  onBegin={counting.begin}
                  className="count-btn grid place-items-center"
                  style={{ ['--count-size' as string]: big ? '5.5rem' : '4.5rem' } as CSSProperties}
                >
                  <Plus size={big ? 34 : 28} strokeWidth={2.4} aria-hidden="true" />
                </HoldButton>
              </div>
            </div>
          );
        })}
      </div>

      {!full && (
        <div className="flex justify-center">
          <Button size="sm" icon={<Plus size={15} />} onClick={add} disabled={rows.length >= cap}>
            Add {noun}
          </Button>
        </div>
      )}
    </div>
  );
}
