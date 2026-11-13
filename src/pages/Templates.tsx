import { useMemo, useState } from 'react';
import { Plus, Save, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useAppState, useConfirm, useDialogs, useStore, useToast } from '../app/context';
import { liveCounters } from '../app/selectors';
import type { Template } from '../core/types';
import { BUILTIN_TEMPLATES, templateCategories } from '../core/templates';
import { MODE_INFO, counterFromConfig } from '../core/counter';
import { CounterIcon } from '../lib/icons';
import { navigate } from '../lib/router';
import { cx } from '../lib/cx';
import { describeConfig } from '../components/counters/summary';
import { stageVars, tileStyle } from '../components/home/shared';
import { Badge, Button, Card, EmptyState, Field, IconButton, PageHeader, Select, TextInput } from '../components/ui';

const MINE = 'My templates';

function TemplateCard({ t, onUse, onCustomise, onDelete }: { t: Template; onUse: () => void; onCustomise: () => void; onDelete?: () => void }) {
  const facts = describeConfig(t.config);
  return (
    <Card className="flex flex-col gap-4 p-5" solid>
      <div style={stageVars(t.config.color)} className="flex items-start gap-3.5">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl shadow-soft" style={tileStyle(t.config.color)}>
          <CounterIcon name={t.config.icon} size={23} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[16px] font-semibold tracking-tight">{t.name}</h3>
          <p className="mt-0.5 line-clamp-2 text-[13.5px] leading-snug text-muted">{t.description || t.config.description}</p>
        </div>
        {onDelete && <IconButton label={`Delete the template ${t.name}`} size="sm" icon={<Trash2 size={16} />} onClick={onDelete} />}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{MODE_INFO[t.config.mode].name}</Badge>
        {facts.map((f) => (
          <Badge key={f}>{f}</Badge>
        ))}
      </div>
      <div className="mt-auto flex gap-2">
        <Button variant="primary" className="flex-1" icon={<Plus size={16} />} onClick={onUse}>
          Use template
        </Button>
        <Button icon={<SlidersHorizontal size={15} />} onClick={onCustomise} aria-label={`Customise ${t.name} before creating`}>
          Customise
        </Button>
      </div>
    </Card>
  );
}

export default function TemplatesPage() {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const dialogs = useDialogs();
  const { templates, counters } = useAppState();
  const live = useMemo(() => liveCounters(counters), [counters]);
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');

  const all = useMemo(() => [...BUILTIN_TEMPLATES, ...templates], [templates]);
  const categories = useMemo(() => ['All', ...templateCategories(BUILTIN_TEMPLATES), ...(templates.length ? [MINE] : [])], [templates.length]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      const mine = !t.builtin;
      if (category === MINE && !mine) return false;
      if (category !== 'All' && category !== MINE && (mine || t.category !== category)) return false;
      if (!q) return true;
      return [t.name, t.description, t.category, MODE_INFO[t.config.mode].name].join(' ').toLowerCase().includes(q);
    });
  }, [all, category, query]);

  const use = (t: Template) => {
    const counter = counterFromConfig(t.config, t.name);
    const created = store.addCounter(counter);
    store.selectCounter(created.id);
    toast(`Created “${created.name}”.`, 'success');
    navigate('/');
  };

  const remove = async (t: Template) => {
    const ok = await confirm({ title: `Delete the template “${t.name}”?`, message: 'Counters you already made from it are not affected.', confirmLabel: 'Delete template', danger: true });
    if (!ok) return;
    store.deleteTemplate(t.id);
    toast('Template deleted.', 'success');
  };

  const saveOwn = () => {
    const source = live.find((c) => c.id === sourceId);
    if (!source || !name.trim()) return;
    const t = store.saveTemplate(source.id, name.trim());
    if (t) {
      toast(`Saved the template “${t.name}”.`, 'success');
      setName('');
      setSourceId('');
      setCategory(MINE);
    }
  };

  return (
    <div>
      <PageHeader title="Templates" subtitle="Ready-made counters. Pick one to start instantly, or customise it first." />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[12rem] flex-1 sm:max-w-sm">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
          <TextInput type="search" value={query} onChange={setQuery} placeholder="Search templates" aria-label="Search templates" className="pl-10" />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Template categories">
        {categories.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={category === c} data-active={category === c} className="chip" onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<Search size={26} />}
          title={category === MINE ? 'No saved templates yet' : 'No templates match'}
          description={category === MINE ? 'Save one from the box below, or from any counter\'s menu.' : 'Try a different word or category.'}
        >
          {(query || category !== 'All') && (
            <Button
              onClick={() => {
                setQuery('');
                setCategory('All');
              }}
            >
              Show all templates
            </Button>
          )}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((t) => (
            <TemplateCard
              key={t.id}
              t={t}
              onUse={() => use(t)}
              onCustomise={() => dialogs.openEditor({ config: t.config, name: t.name })}
              onDelete={t.builtin ? undefined : () => void remove(t)}
            />
          ))}
        </div>
      )}

      <section className={cx('card mt-10 p-5 sm:p-6')} aria-labelledby="save-template">
        <h2 id="save-template" className="text-lg font-semibold tracking-tight">
          Save your own template
        </h2>
        <p className="mt-1 max-w-xl text-sm text-muted">
          Turn one of your counters into a template. It keeps the type, colour, icon, step, limits, goal and player names, but not the current value or history.
        </p>
        {live.length === 0 ? (
          <p className="mt-4 text-sm text-muted">Create a counter first, then come back here.</p>
        ) : (
          <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Counter" htmlFor="tpl-source">
              <Select
                id="tpl-source"
                value={sourceId}
                onChange={(id) => {
                  setSourceId(id);
                  const c = live.find((x) => x.id === id);
                  if (c && !name) setName(c.name);
                }}
                options={[{ value: '', label: 'Choose a counter…' }, ...live.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </Field>
            <Field label="Template name" htmlFor="tpl-new-name">
              <TextInput id="tpl-new-name" value={name} onChange={setName} maxLength={80} placeholder="e.g. Weekly reading goal" onKeyDown={(e) => e.key === 'Enter' && saveOwn()} />
            </Field>
            <Button variant="primary" icon={<Save size={16} />} disabled={!sourceId || !name.trim()} onClick={saveOwn}>
              Save template
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
