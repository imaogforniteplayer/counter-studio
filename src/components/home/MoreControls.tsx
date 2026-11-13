import { useMemo, useState } from 'react';
import { ChevronDown, Minus, Pencil, Play, Plus, Square } from 'lucide-react';
import { useAppState, useDialogs, useSettings, useStore } from '../../app/context';
import type { Counter } from '../../core/types';
import { MODE_INFO } from '../../core/counter';
import { computeStreaks, sessionsFrom, summarize } from '../../core/stats';
import { dayKey, formatNumber, signed } from '../../core/format';
import { cx } from '../../lib/cx';
import { Button, Field, NumberField, Segmented, Select } from '../ui';
import { formatInterval } from '../counters/summary';
import type { AutoCount } from './useAutoCount';
import type { Counting } from './useCounting';
import { isSingleValue } from './shared';

const PRESETS = [100, 250, 500, 1000, 2000, 5000, 10_000, 30_000, 60_000];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line/10 bg-raised/40 px-3.5 py-3">
      <p className="eyebrow">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

/** The advanced controls, tucked away so the main counter screen stays clean. */
export function MoreControls({ counter: c, counting, auto }: { counter: Counter; counting: Counting; auto: AutoCount }) {
  const store = useStore();
  const settings = useSettings();
  const dialogs = useDialogs();
  const { history } = useAppState();
  const [open, setOpen] = useState(false);
  const [sign, setSign] = useState<'add' | 'sub'>('add');
  const [custom, setCustom] = useState<number | null>(25);
  const single = isSingleValue(c.mode);

  const apply = (amount: number, direction: 1 | -1) => {
    counting.begin();
    counting.bump(direction, amount);
  };

  const stats = useMemo(() => {
    const mine = history.filter((e) => e.counterId === c.id);
    if (mine.length === 0) return null;
    const now = Date.now();
    const today = dayKey(now);
    const todays = mine.filter((e) => dayKey(e.at) === today && (e.kind === 'inc' || e.kind === 'dec' || e.kind === 'auto'));
    const sums = summarize(mine, [c.value]);
    const streaks = computeStreaks(mine, now);
    const sessions = sessionsFrom(mine);
    const latest = sessions.length ? sessions[sessions.length - 1] : null;
    return { todays: todays.length, highest: sums.highest, lowest: sums.lowest, streak: streaks.current, net: latest ? latest.net : 0 };
  }, [history, c.id, c.value]);

  const intervalOptions = PRESETS.includes(c.intervalMs) ? PRESETS : [...PRESETS, c.intervalMs].sort((a, b) => a - b);

  return (
    <section className="card">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="more-controls"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block text-[15px] font-semibold">More controls</span>
          <span className="block text-[13px] text-muted">Quick amounts, custom amounts, auto-count and this counter's stats</span>
        </span>
        <ChevronDown size={18} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div id="more-controls" className="space-y-7 border-t border-line/10 px-5 pb-5 pt-5">
          {single && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="eyebrow">Quick amounts</h3>
                <Segmented
                  size="sm"
                  ariaLabel="Add or subtract"
                  value={sign}
                  onChange={setSign}
                  options={[
                    { value: 'add', label: 'Add', icon: <Plus size={13} /> },
                    { value: 'sub', label: 'Subtract', icon: <Minus size={13} /> },
                  ]}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {settings.quickAmounts.map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="chip h-10 min-w-[3.5rem] justify-center px-4 text-[15px] font-medium text-ink"
                    aria-label={`${sign === 'add' ? 'Add' : 'Subtract'} ${n}`}
                    onClick={() => apply(n, sign === 'add' ? 1 : -1)}
                  >
                    {sign === 'add' ? '+' : '−'}
                    {formatNumber(n)}
                  </button>
                ))}
              </div>

              <Field label="Custom amount" htmlFor="custom-amount" hint="Add or subtract any amount, separate from the step.">
                <div className="flex flex-wrap items-center gap-2">
                  <NumberField id="custom-amount" value={custom} onChange={setCustom} className="w-32" aria-label="Custom amount" />
                  <Button icon={<Plus size={16} />} disabled={custom === null || custom <= 0} onClick={() => custom && apply(custom, 1)}>
                    Add
                  </Button>
                  <Button icon={<Minus size={16} />} disabled={custom === null || custom <= 0} onClick={() => custom && apply(custom, -1)}>
                    Subtract
                  </Button>
                </div>
              </Field>
            </div>
          )}

          {single && (
            <div className="space-y-3">
              <h3 className="eyebrow">Auto-count</h3>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Every" htmlFor="auto-every" className="w-40">
                  <Select
                    id="auto-every"
                    value={String(c.intervalMs)}
                    onChange={(v) => store.updateCounter(c.id, { intervalMs: Number(v) })}
                    options={intervalOptions.map((ms) => ({ value: String(ms), label: formatInterval(ms) }))}
                  />
                </Field>
                <Segmented
                  ariaLabel="Auto-count direction"
                  value={c.intervalDirection === 1 ? 'up' : 'down'}
                  onChange={(v) => store.updateCounter(c.id, { intervalDirection: v === 'up' ? 1 : -1 })}
                  options={[
                    { value: 'up', label: 'Up' },
                    { value: 'down', label: 'Down' },
                  ]}
                />
                {c.mode !== 'interval' && (
                  <Button
                    variant={auto.running ? 'danger' : 'primary'}
                    icon={auto.running ? <Square size={15} /> : <Play size={15} />}
                    onClick={auto.toggle}
                    aria-pressed={auto.running}
                  >
                    {auto.running ? 'Stop' : 'Start'}
                  </Button>
                )}
              </div>
              <p className="text-[13px] text-muted">
                Adds {formatNumber(c.step)} each time, only while this screen is open. It stops by itself at a limit or when a goal is reached.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="eyebrow">This counter</h3>
              <Button size="sm" variant="ghost" icon={<Pencil size={14} />} onClick={() => dialogs.openEditor({ counterId: c.id })}>
                Edit
              </Button>
            </div>
            <p className="text-[13.5px] text-muted">
              {MODE_INFO[c.mode].name} · step {formatNumber(c.step)}
              {c.min !== null ? ` · minimum ${formatNumber(c.min)}` : ''}
              {c.max !== null ? ` · maximum ${formatNumber(c.max)}` : ''}
              {c.mode === 'goal' && c.goal !== null ? ` · goal ${formatNumber(c.goal)}` : ''}
            </p>
            {stats ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Changes today" value={formatNumber(stats.todays)} />
                <Stat label="Day streak" value={`${formatNumber(stats.streak)} ${stats.streak === 1 ? 'day' : 'days'}`} />
                <Stat label="Highest" value={stats.highest === null ? '–' : formatNumber(stats.highest)} />
                <Stat label="Lowest" value={stats.lowest === null ? '–' : formatNumber(stats.lowest)} />
                <Stat label="Latest session" value={signed(stats.net)} />
              </div>
            ) : (
              <p className="text-[13.5px] text-muted">Stats appear here once you start counting.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
