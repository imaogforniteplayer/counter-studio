import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, BarChart3, Flame, Minus, Trophy } from 'lucide-react';
import { useAppState } from '../app/context';
import { liveCounters } from '../app/selectors';
import { RANGES, bucketize, bucketLabel, comparePeriods, computeStreaks, goalHistory, inWindow, rangeWindow, sessionsFrom, statsByCounter, summarize } from '../core/stats';
import type { RangeKey } from '../core/stats';
import {
  GRANULARITIES,
  WEEKDAY_LABELS,
  activityByPeriod,
  granularityAllowed,
  hourCounts,
  percentChange,
  resolveBucket,
  sortCounterStats,
  weekdayCounts,
} from '../core/histview';
import type { CounterSortKey, Granularity } from '../core/histview';
import { formatDateTime, formatNumber, relativeTime, signed } from '../core/format';
import { navigate } from '../lib/router';
import { BarChart, ShareBars } from '../components/charts';
import { Button, Card, EmptyState, PageHeader, Segmented, Select } from '../components/ui';

function Tile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: ReactNode }) {
  return (
    <Card className="p-4" solid>
      <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-[26px] font-semibold leading-tight tracking-tight tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
    </Card>
  );
}

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-muted">No earlier activity to compare</span>;
  const rounded = Math.round(pct);
  if (rounded === 0) return (
    <span className="inline-flex items-center gap-1 text-muted">
      <Minus size={13} aria-hidden="true" /> Same as before
    </span>
  );
  const up = rounded > 0;
  return (
    <span className={up ? 'inline-flex items-center gap-1 text-good' : 'inline-flex items-center gap-1 text-bad'}>
      {up ? <ArrowUp size={13} aria-hidden="true" /> : <ArrowDown size={13} aria-hidden="true" />}
      {Math.abs(rounded)}% {up ? 'more' : 'less'} than the period before
    </span>
  );
}

const COLUMNS: { key: CounterSortKey; label: string }[] = [
  { key: 'name', label: 'Counter' },
  { key: 'activity', label: 'Changes' },
  { key: 'net', label: 'Net' },
  { key: 'highest', label: 'Highest' },
  { key: 'lowest', label: 'Lowest' },
  { key: 'last', label: 'Last used' },
];

export default function StatsPage() {
  const { counters, history } = useAppState();
  const live = useMemo(() => liveCounters(counters), [counters]);
  const [range, setRange] = useState<RangeKey>('30d');
  const [counterId, setCounterId] = useState('all');
  const [gran, setGran] = useState<Granularity>('auto');
  const [sort, setSort] = useState<{ key: CounterSortKey; dir: 'asc' | 'desc' }>({ key: 'activity', dir: 'desc' });
  const now = Date.now();

  const scoped = useMemo(() => (counterId === 'all' ? history : history.filter((e) => e.counterId === counterId)), [history, counterId]);
  const earliest = scoped.reduce<number | undefined>((m, e) => (m === undefined || e.at < m ? e.at : m), undefined);
  const win = useMemo(() => rangeWindow(range, now, earliest), [range, now, earliest]);
  const bucket = resolveBucket(win, gran);
  const inRange = useMemo(() => inWindow(scoped, win), [scoped, win]);
  const summary = useMemo(() => summarize(inRange), [inRange]);
  const compare = useMemo(() => comparePeriods(scoped, win), [scoped, win]);
  const streaks = useMemo(() => computeStreaks(scoped, now), [scoped, now]);
  const points = useMemo(() => bucketize(inRange, { ...win, bucket }), [inRange, win, bucket]);
  const weekdays = useMemo(() => weekdayCounts(inRange), [inRange]);
  const hours = useMemo(() => hourCounts(inRange), [inRange]);
  const week = useMemo(() => activityByPeriod(scoped, now, 'week'), [scoped, now]);
  const month = useMemo(() => activityByPeriod(scoped, now, 'month'), [scoped, now]);
  const goals = useMemo(() => goalHistory(inRange), [inRange]);
  const sessions = useMemo(() => sessionsFrom(inRange).slice(0, 5), [inRange]);
  const rows = useMemo(() => {
    const targets = counterId === 'all' ? live : live.filter((c) => c.id === counterId);
    return sortCounterStats(statsByCounter(inRange, targets), sort.key, sort.dir);
  }, [inRange, live, counterId, sort]);
  const nameOf = useMemo(() => Object.fromEntries(counters.map((c) => [c.id, c.name])), [counters]);

  if (history.length === 0) {
    return (
      <div>
        <PageHeader title="Statistics" subtitle="Charts and totals from your counting history." />
        <EmptyState icon={<BarChart3 size={26} />} title="Nothing to chart yet" description="Statistics appear as soon as you start counting. Every change is recorded on this device.">
          <Button variant="primary" onClick={() => navigate('/')}>
            Go count something
          </Button>
        </EmptyState>
      </div>
    );
  }

  const bars = points.map((p) => ({
    label: p.label,
    value: p.increments,
    value2: p.decrements,
    detail: `${bucketLabel(p.start, bucket)}: ${p.increments} up, ${p.decrements} down`,
  }));
  const toggleSort = (key: CounterSortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'name' ? 'asc' : 'desc' }));
  const weekChange = percentChange(week.current, week.previous);
  const monthChange = percentChange(month.current, month.previous);

  return (
    <div className="space-y-6 pb-10">
      <PageHeader title="Statistics" subtitle="Charts and totals from your counting history." />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented ariaLabel="Time range" value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.id, label: r.label }))} size="sm" />
        <Select
          aria-label="Counter"
          className="w-52"
          value={counterId}
          onChange={setCounterId}
          options={[{ value: 'all', label: 'All counters' }, ...live.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Changes" value={formatNumber(summary.activity)} sub={`${formatNumber(summary.increments)} up · ${formatNumber(summary.decrements)} down`} />
        <Tile label="Net change" value={signed(summary.net)} sub={`+${formatNumber(summary.amountUp)} / −${formatNumber(summary.amountDown)}`} />
        <Tile label="Active days" value={formatNumber(summary.activeDays)} sub={range === 'today' ? 'today' : 'in this period'} />
        <Tile label="Streak" icon={<Flame size={14} aria-hidden="true" />} value={`${streaks.current} ${streaks.current === 1 ? 'day' : 'days'}`} sub={`Longest ${streaks.longest}${streaks.activeToday ? '' : streaks.current > 0 ? ' · count today to keep it' : ''}`} />
        <Tile label="Highest value" value={summary.highest === null ? '–' : formatNumber(summary.highest)} />
        <Tile label="Lowest value" value={summary.lowest === null ? '–' : formatNumber(summary.lowest)} />
        <Tile label="Goals reached" icon={<Trophy size={14} aria-hidden="true" />} value={formatNumber(summary.goalCompletions)} />
        <Tile label="Edits and resets" value={formatNumber(summary.edits)} sub="manual sets, resets, undos" />
      </div>

      <Card className="space-y-3 p-5" solid>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[16px] font-semibold tracking-tight">Activity over time</h2>
            <p className="text-[13px]">
              <Change pct={compare.activityChange} />
            </p>
          </div>
          <Segmented
            ariaLabel="Chart granularity"
            size="sm"
            value={gran}
            onChange={setGran}
            options={GRANULARITIES.filter((g) => granularityAllowed(win, g.id)).map((g) => ({ value: g.id, label: g.label }))}
          />
        </div>
        <BarChart data={bars} title="Increases and decreases over time" legend={['Increases', 'Decreases']} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">By weekday</h2>
          <BarChart height={170} title="Changes by weekday" data={WEEKDAY_LABELS.map((l, i) => ({ label: l, value: weekdays[i] }))} />
        </Card>
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">By hour of day</h2>
          <BarChart height={170} title="Changes by hour of the day" data={hours.map((v, h) => ({ label: String(h).padStart(2, '0'), value: v, detail: `${String(h).padStart(2, '0')}:00 to ${String(h).padStart(2, '0')}:59: ${v}` }))} />
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">This week and this month</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-muted">This week so far</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatNumber(week.current)} <span className="text-sm font-normal text-muted">vs {formatNumber(week.previous)} last week</span>
              </dd>
              <dd className="text-[13px]">
                <Change pct={weekChange} />
              </dd>
            </div>
            <div>
              <dt className="text-muted">This month so far</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {formatNumber(month.current)} <span className="text-sm font-normal text-muted">vs {formatNumber(month.previous)} last month</span>
              </dd>
              <dd className="text-[13px]">
                <Change pct={monthChange} />
              </dd>
            </div>
          </dl>
        </Card>
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">Most active counters</h2>
          {rows.filter((r) => r.summary.activity > 0).length === 0 ? (
            <p className="text-sm text-muted">No changes in this period.</p>
          ) : (
            <ShareBars rows={rows.filter((r) => r.summary.activity > 0).slice(0, 6).map((r) => ({ label: r.counter.name, value: r.summary.activity }))} />
          )}
        </Card>
      </div>

      <Card className="p-0" solid>
        <div className="p-5 pb-3">
          <h2 className="text-[16px] font-semibold tracking-tight">Counters compared</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-y border-line/10 text-[12.5px] text-muted">
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-5 py-2 font-medium" aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                    <button type="button" className="inline-flex items-center gap-1 hover:text-ink" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      {sort.key === c.key && (sort.dir === 'asc' ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.counter.id} className="border-b border-line/5 last:border-0">
                  <th scope="row" className="px-5 py-2.5 font-medium">
                    {r.counter.name}
                  </th>
                  <td className="px-5 py-2.5 tabular-nums">{formatNumber(r.summary.activity)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{signed(r.summary.net)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{r.summary.highest === null ? '–' : formatNumber(r.summary.highest)}</td>
                  <td className="px-5 py-2.5 tabular-nums">{r.summary.lowest === null ? '–' : formatNumber(r.summary.lowest)}</td>
                  <td className="px-5 py-2.5 text-muted">{r.lastActivity === null ? '–' : relativeTime(r.lastActivity, now)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">Goals reached</h2>
          {goals.length === 0 ? (
            <p className="text-sm text-muted">No goals reached in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {goals.slice(0, 8).map((g) => (
                <li key={g.id} className="flex justify-between gap-3">
                  <span className="truncate">{nameOf[g.counterId] ?? 'Deleted counter'}{g.label ? ` · ${g.label}` : ''}</span>
                  <span className="shrink-0 text-muted">{formatDateTime(g.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="space-y-3 p-5" solid>
          <h2 className="text-[16px] font-semibold tracking-tight">Recent sessions</h2>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted">No sessions in this period.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {sessions.map((s) => (
                <li key={s.id} className="flex justify-between gap-3">
                  <span>
                    {formatDateTime(s.start)}
                    <span className="text-muted"> · {s.counters} {s.counters === 1 ? 'counter' : 'counters'}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-muted">
                    {formatNumber(s.events)} changes · {signed(s.net)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
