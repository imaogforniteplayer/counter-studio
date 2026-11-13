import { useEffect, useMemo, useState } from 'react';
import { Download, History as HistoryIcon, Search, Trash2, Undo2 } from 'lucide-react';
import { useAppState, useConfirm, useStore, useToast } from '../app/context';
import { canRevertEntry } from '../data/store';
import { historyToCsv } from '../core/csv';
import { formatNumber, formatTime, signed } from '../core/format';
import { KIND_GROUPS, NO_FILTERS, dateInputValue, endOfDay, filterEntries, groupByDay, hasActiveFilters, kindGroup, kindLabel, parseDateInput, summarizeView } from '../core/histview';
import type { HistoryFilters, KindGroup } from '../core/histview';
import { downloadText, stamp } from '../lib/files';
import { navigate } from '../lib/router';
import { cx } from '../lib/cx';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextInput } from '../components/ui';

const PAGE = 100;

export default function HistoryPage() {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { counters, history } = useAppState();
  const [filters, setFilters] = useState<HistoryFilters>(NO_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const now = Date.now();

  const names = useMemo(() => Object.fromEntries(counters.map((c) => [c.id, c.name])), [counters]);
  const rows = useMemo(() => filterEntries(history, filters, names), [history, filters, names]);
  const totals = useMemo(() => summarizeView(rows), [rows]);
  const groups = useMemo(() => groupByDay(rows.slice(0, shown), now), [rows, shown, now]);

  useEffect(() => setShown(PAGE), [filters]);

  const set = (patch: Partial<HistoryFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const toggleKind = (k: KindGroup) => set({ kinds: filters.kinds.includes(k) ? filters.kinds.filter((x) => x !== k) : [...filters.kinds, k] });
  const active = hasActiveFilters(filters) || filters.counterId !== null;

  const revert = (id: string) => {
    const r = store.revertEntry(id);
    if (r === 'ok') toast('Change reverted. The counter was adjusted to match.', 'success');
    else if (r === 'blocked') toast("That change can't be reverted because the counter has hit its limit.", 'error');
    else toast('That change can no longer be reverted.', 'error');
  };

  const exportCsv = () => {
    downloadText(`tickwell-history-${stamp()}.csv`, historyToCsv(rows, names), 'text/csv');
    toast(`Exported ${formatNumber(rows.length)} entries.`, 'success');
  };

  const clear = async () => {
    const scope = filters.counterId ? names[filters.counterId] ?? 'this counter' : 'every counter';
    const ok = await confirm({
      title: `Delete history for ${scope}?`,
      message: 'Counter values stay as they are. This removes the log and the statistics built from it. Make a backup first if you might want it back.',
      confirmLabel: 'Delete history',
      danger: true,
    });
    if (!ok) return;
    const n = store.clearHistory(filters.counterId ?? undefined);
    toast(`Deleted ${formatNumber(n)} entries.`, 'success');
  };

  if (history.length === 0) {
    return (
      <div>
        <PageHeader title="History" subtitle="Every change, in order." />
        <EmptyState icon={<HistoryIcon size={26} />} title="No history yet" description="Each time you count, it is logged here with the time, so you can look back or undo a single change.">
          <Button variant="primary" onClick={() => navigate('/')}>
            Go count something
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <PageHeader
        title="History"
        subtitle="Every change, newest first. Search, filter and revert individual changes."
        actions={
          <>
            <Button icon={<Download size={16} />} onClick={exportCsv} disabled={rows.length === 0}>
              Export CSV
            </Button>
            <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => void clear()}>
              Delete history…
            </Button>
          </>
        }
      />

      <Card className="mb-5 space-y-4 p-4" solid>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <TextInput type="search" aria-label="Search history" placeholder="Search by name, number, date…" className="pl-10" value={filters.query} onChange={(query) => set({ query })} />
          </div>
          <Select
            aria-label="Counter"
            value={filters.counterId ?? ''}
            onChange={(v) => set({ counterId: v || null })}
            options={[{ value: '', label: 'All counters' }, ...Object.entries(names).map(([id, name]) => ({ value: id, label: name }))]}
          />
          <div className="flex items-center gap-2">
            <Field label="From" htmlFor="h-from" className="flex-1">
              <TextInput id="h-from" type="date" value={filters.from === null ? '' : dateInputValue(filters.from)} onChange={(v) => set({ from: parseDateInput(v) })} />
            </Field>
            <Field label="To" htmlFor="h-to" className="flex-1">
              <TextInput id="h-to" type="date" value={filters.to === null ? '' : dateInputValue(filters.to)} onChange={(v) => { const t = parseDateInput(v); set({ to: t === null ? null : endOfDay(t) }); }} />
            </Field>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Kinds of change">
          {KIND_GROUPS.map((k) => (
            <button key={k.id} type="button" className="chip" data-active={filters.kinds.includes(k.id)} aria-pressed={filters.kinds.includes(k.id)} onClick={() => toggleKind(k.id)}>
              {k.label}
            </button>
          ))}
          {active && (
            <Button size="sm" variant="ghost" onClick={() => setFilters(NO_FILTERS)}>
              Clear filters
            </Button>
          )}
        </div>
        <p className="text-[13px] text-muted" aria-live="polite">
          {formatNumber(rows.length)} {rows.length === 1 ? 'entry' : 'entries'} · {formatNumber(totals.changes)} changes, net {signed(totals.net)} · {formatNumber(totals.milestones)} milestones
        </p>
      </Card>

      {rows.length === 0 ? (
        <EmptyState icon={<Search size={26} />} title="Nothing matches" description="Try removing a filter or searching for something else.">
          <Button onClick={() => setFilters(NO_FILTERS)}>Clear filters</Button>
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.key} aria-label={g.label}>
              <h2 className="eyebrow mb-2">{g.label}</h2>
              <ul className="divide-y divide-line/10 overflow-hidden rounded-xl border border-line/15 bg-surface">
                {g.entries.map((e) => {
                  const grp = kindGroup(e);
                  const goal = e.kind === 'goal';
                  return (
                    <li key={e.id} className={cx('flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3', e.reverted && 'opacity-60')}>
                      <span className="w-14 shrink-0 text-[12.5px] tabular-nums text-muted">{formatTime(e.at)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">
                          {names[e.counterId] ?? 'Deleted counter'}
                          {e.label && e.kind !== 'undo' && <span className="font-normal text-muted"> · {e.label}</span>}
                        </p>
                        <p className="text-[12.5px] text-muted">
                          {kindLabel(e)}
                          {!goal && (
                            <>
                              {' · '}
                              <span className="tabular-nums">{formatNumber(e.prev)} → {formatNumber(e.next)}</span>
                            </>
                          )}
                        </p>
                      </div>
                      {e.reverted && <Badge>Reverted</Badge>}
                      {goal ? (
                        <Badge tone="good">Goal reached</Badge>
                      ) : (
                        <span className={cx('w-16 shrink-0 text-right text-[15px] font-semibold tabular-nums', e.delta > 0 ? 'text-good' : e.delta < 0 ? 'text-bad' : 'text-muted')} data-group={grp}>
                          {signed(e.delta)}
                        </span>
                      )}
                      <span className="w-9 shrink-0">
                        {canRevertEntry(e, counters) && (
                          <Button size="sm" variant="ghost" icon={<Undo2 size={15} />} aria-label={`Revert this change to ${names[e.counterId] ?? 'the counter'} at ${formatTime(e.at)}`} title="Revert this change" onClick={() => revert(e.id)} />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {rows.length > shown && (
            <div className="text-center">
              <Button onClick={() => setShown((n) => n + PAGE)}>Show more ({formatNumber(rows.length - shown)} left)</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
