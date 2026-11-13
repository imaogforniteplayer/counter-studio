import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { useAppState, useConfirm, useStore, useToast } from '../app/context';
import type { EditorOptions } from '../app/context';
import type { CardStyle, Counter, CounterMode, Player, SubCounter } from '../core/types';
import { CARD_STYLES, MODES, MODE_INFO, counterFromConfig, createCounter, newPlayer, newSubCounter } from '../core/counter';
import { SWATCHES, gradientCss } from '../core/colors';
import { formatNumber } from '../core/format';
import { CounterIcon, ICON_KEYS } from '../lib/icons';
import { navigate } from '../lib/router';
import { cx } from '../lib/cx';
import { CounterCard } from './CounterCard';
import { Button, ColorPicker, Field, Modal, NumberField, Segmented, Select, TextArea, TextInput, Toggle } from './ui';

type Unit = 'ms' | 's' | 'min';
const UNIT_MS: Record<Unit, number> = { ms: 1, s: 1000, min: 60_000 };

interface Draft {
  name: string;
  description: string;
  mode: CounterMode;
  color: string;
  icon: string;
  cardStyle: CardStyle;
  folderId: string | null;
  step: number | null;
  startValue: number | null;
  min: number | null;
  max: number | null;
  goal: number | null;
  intervalAmount: number | null;
  intervalUnit: Unit;
  intervalDirection: 1 | -1;
  players: Player[];
  subCounters: SubCounter[];
}

function unitFor(ms: number): { amount: number; unit: Unit } {
  if (ms >= 60_000 && ms % 60_000 === 0) return { amount: ms / 60_000, unit: 'min' };
  if (ms >= 1000 && ms % 1000 === 0) return { amount: ms / 1000, unit: 's' };
  return { amount: ms, unit: 'ms' };
}

function draftFrom(c: Counter): Draft {
  const { amount, unit } = unitFor(c.intervalMs);
  return {
    name: c.name,
    description: c.description,
    mode: c.mode,
    color: c.color,
    icon: c.icon,
    cardStyle: c.cardStyle,
    folderId: c.folderId,
    step: c.step,
    startValue: c.startValue,
    min: c.min,
    max: c.max,
    goal: c.goal,
    intervalAmount: amount,
    intervalUnit: unit,
    intervalDirection: c.intervalDirection,
    players: c.players.map((p) => ({ ...p })),
    subCounters: c.subCounters.map((s) => ({ ...s })),
  };
}

const MAX_PLAYERS = 12;
const MAX_SUBS = 24;

function validate(d: Draft): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.name.trim()) e.name = 'Give your counter a name.';
  if (d.step === null || d.step <= 0) e.step = 'The step must be greater than 0.';
  if (d.startValue === null) e.startValue = 'Enter a starting number (0 is fine).';
  if (d.min !== null && d.max !== null && d.min > d.max) e.limits = 'The minimum cannot be higher than the maximum.';
  if (d.startValue !== null) {
    if (d.min !== null && d.startValue < d.min) e.startValue = `The starting value is below the minimum of ${formatNumber(d.min)}.`;
    if (d.max !== null && d.startValue > d.max) e.startValue = `The starting value is above the maximum of ${formatNumber(d.max)}.`;
  }
  if (d.mode === 'goal' && d.goal === null) e.goal = 'Set the number you are aiming for.';
  if (d.mode === 'interval') {
    const ms = (d.intervalAmount ?? 0) * UNIT_MS[d.intervalUnit];
    if (!(ms >= 50)) e.interval = 'The shortest interval is 50 milliseconds.';
    else if (ms > 3_600_000) e.interval = 'The longest interval is 60 minutes.';
  }
  if (d.mode === 'score') {
    if (d.players.length < 2) e.players = 'Add at least two players or teams.';
    else if (d.players.some((p) => !p.name.trim())) e.players = 'Every player needs a name.';
  }
  if (d.mode === 'multi') {
    if (d.subCounters.length < 1) e.subs = 'Add at least one counter.';
    else if (d.subCounters.some((s) => !s.name.trim())) e.subs = 'Every counter needs a name.';
  }
  return e;
}

function NamedList<T extends { id: string; name: string; color: string }>({
  items,
  onChange,
  make,
  max,
  min,
  noun,
}: {
  items: T[];
  onChange: (items: T[]) => void;
  make: (index: number) => T;
  max: number;
  min: number;
  noun: string;
}) {
  const update = (id: string, patch: Partial<T>) => onChange(items.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const cycleColor = (item: T) => {
    const at = SWATCHES.findIndex((s) => s.id === item.color);
    update(item.id, { color: SWATCHES[(at + 1) % SWATCHES.length].id } as Partial<T>);
  };
  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <button
            type="button"
            aria-label={`Change colour of ${item.name || `${noun} ${i + 1}`}`}
            title="Click to change colour"
            onClick={() => cycleColor(item)}
            className="h-9 w-9 shrink-0 rounded-full ring-1 ring-line/20 transition-transform hover:scale-105"
            style={{ background: gradientCss(item.color) }}
          />
          <TextInput
            value={item.name}
            maxLength={40}
            aria-label={`${noun} ${i + 1} name`}
            onChange={(name) => update(item.id, { name } as Partial<T>)}
          />
          <button
            type="button"
            aria-label={`Remove ${item.name || `${noun} ${i + 1}`}`}
            disabled={items.length <= min}
            onClick={() => onChange(items.filter((x) => x.id !== item.id))}
            className="btn btn-ghost h-9 w-9 shrink-0 p-0"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
      <Button size="sm" icon={<Plus size={15} />} disabled={items.length >= max} onClick={() => onChange([...items, make(items.length)])}>
        Add {noun.toLowerCase()}
      </Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3.5">
      <h3 className="eyebrow">{title}</h3>
      {children}
    </section>
  );
}

const CARD_LABEL: Record<CardStyle, string> = { solid: 'Solid', glass: 'Glass', outline: 'Outline', gradient: 'Gradient' };

function EditorInner({ options, onClose }: { options: EditorOptions; onClose: () => void }) {
  const store = useStore();
  const toast = useToast();
  const confirm = useConfirm();
  const { counters, folders } = useAppState();
  const editing = options.counterId ? counters.find((c) => c.id === options.counterId && c.deletedAt === null) : undefined;

  const initial = useMemo<Draft>(() => {
    if (editing) return draftFrom(editing);
    if (options.config) {
      const c = counterFromConfig(options.config, options.name ?? 'Untitled counter');
      return { ...draftFrom(c), folderId: options.folderId ?? null };
    }
    return { ...draftFrom(createCounter({ mode: options.mode ?? 'normal', name: options.name })), folderId: options.folderId ?? null };
    // The draft is created once per opening of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const needsModePick = !editing && !options.mode && !options.config;
  const [stage, setStage] = useState<'mode' | 'form'>(needsModePick ? 'mode' : 'form');
  const [draft, setDraft] = useState<Draft>(initial);
  const [resetValue, setResetValue] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [iconsOpen, setIconsOpen] = useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const errors = validate(draft);
  const valid = Object.keys(errors).length === 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const err = (key: string) => (showErrors ? errors[key] : undefined);

  const pickMode = (mode: CounterMode) => {
    const base = createCounter({ mode });
    setDraft({ ...draftFrom(base), folderId: options.folderId ?? null, name: draft.name === initial.name ? base.name : draft.name });
    setStage('form');
  };

  const close = async () => {
    if (dirty && stage === 'form') {
      const ok = await confirm({ title: 'Discard your changes?', message: 'What you have entered will be lost.', confirmLabel: 'Discard', cancelLabel: 'Keep editing', danger: true });
      if (!ok) return;
    }
    onClose();
  };

  const preview = useMemo(
    () =>
      createCounter({
        mode: draft.mode,
        name: draft.name.trim() || 'Your counter',
        description: draft.description,
        color: draft.color,
        icon: draft.icon,
        cardStyle: draft.cardStyle,
        startValue: draft.startValue ?? 0,
        step: draft.step ?? 1,
        min: draft.min,
        max: draft.max,
        goal: draft.goal,
        intervalMs: Math.max(50, (draft.intervalAmount ?? 1) * UNIT_MS[draft.intervalUnit]),
        intervalDirection: draft.intervalDirection,
        players: draft.players,
        subCounters: draft.subCounters,
        value: editing ? editing.value : undefined,
      }),
    [draft, editing],
  );

  const submit = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    const intervalMs = Math.round((draft.intervalAmount ?? 1) * UNIT_MS[draft.intervalUnit]);
    const common: Partial<Counter> = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      color: draft.color,
      icon: draft.icon,
      cardStyle: draft.cardStyle,
      folderId: draft.folderId,
      step: draft.step ?? 1,
      startValue: draft.startValue ?? 0,
      min: draft.min,
      max: draft.max,
      goal: draft.mode === 'goal' ? draft.goal : null,
      intervalMs,
      intervalDirection: draft.intervalDirection,
      players: draft.mode === 'score' ? draft.players.map((p) => ({ ...p, name: p.name.trim() })) : [],
      subCounters: draft.mode === 'multi' ? draft.subCounters.map((s) => ({ ...s, name: s.name.trim() })) : [],
    };
    if (editing) {
      const patch: Partial<Counter> = { ...common };
      if (resetValue && draft.startValue !== null) patch.value = draft.startValue;
      store.updateCounter(editing.id, patch);
      toast('Changes saved.', 'success');
      onClose();
      return;
    }
    const created = store.addCounter({ ...common, mode: draft.mode });
    store.selectCounter(created.id);
    toast(`Created “${created.name}”.`, 'success');
    navigate('/');
    onClose();
  };

  const startChanged = !!editing && draft.startValue !== null && draft.startValue !== editing.startValue;
  const m = draft.mode;
  const isSingle = m !== 'score' && m !== 'multi';

  const footer =
    stage === 'mode' ? (
      <Button onClick={() => void close()}>Cancel</Button>
    ) : (
      <>
        {!editing && needsModePick && (
          <Button variant="ghost" icon={<ChevronLeft size={16} />} onClick={() => setStage('mode')} className="mr-auto">
            Change type
          </Button>
        )}
        <Button onClick={() => void close()}>Cancel</Button>
        <Button variant="primary" onClick={submit} disabled={showErrors && !valid}>
          {editing ? 'Save changes' : 'Create counter'}
        </Button>
      </>
    );

  return (
    <Modal
      open
      onClose={() => void close()}
      size="lg"
      title={editing ? 'Edit counter' : stage === 'mode' ? 'What are you counting?' : `New ${MODE_INFO[draft.mode].name.toLowerCase()}`}
      description={stage === 'mode' ? 'Pick a style. You can create as many counters as you like.' : undefined}
      footer={footer}
    >
      {stage === 'mode' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => pickMode(mode)}
              className="flex items-start gap-3.5 rounded-2xl border border-line/10 bg-raised/50 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-accent/50 hover:bg-raised"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-onaccent" style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))' }}>
                <CounterIcon name={MODE_INFO[mode].icon} size={21} />
              </span>
              <span>
                <span className="block text-[15px] font-semibold">{MODE_INFO[mode].name}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-muted">{MODE_INFO[mode].blurb}</span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <form
          className="space-y-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="mx-auto max-w-sm">
            <CounterCard counter={preview} view="grid" />
          </div>

          <Section title="Basics">
            <Field label="Name" htmlFor="ce-name" error={err('name')}>
              <TextInput
                id="ce-name"
                value={draft.name}
                maxLength={80}
                placeholder="e.g. Morning laps"
                onChange={(v) => set('name', v)}
                autoFocus={!!editing || !needsModePick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
            </Field>
            <Field label="Description (optional)" htmlFor="ce-desc">
              <TextArea id="ce-desc" rows={2} value={draft.description} maxLength={500} onChange={(v) => set('description', v)} placeholder="What is this for?" />
            </Field>
          </Section>

          <Section title="Numbers">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Step" htmlFor="ce-step" hint="How much each tap adds or subtracts." error={err('step')}>
                <NumberField id="ce-step" value={draft.step} onChange={(v) => set('step', v)} />
              </Field>
              {isSingle && (
                <Field label={m === 'countdown' ? 'Count down from' : 'Starting value'} htmlFor="ce-start" error={err('startValue')}>
                  <NumberField id="ce-start" value={draft.startValue} onChange={(v) => set('startValue', v)} />
                </Field>
              )}
              {m === 'goal' && (
                <Field label="Goal" htmlFor="ce-goal" hint="Progress is measured towards this number." error={err('goal')}>
                  <NumberField id="ce-goal" value={draft.goal} onChange={(v) => set('goal', v)} />
                </Field>
              )}
              <Field label="Minimum (optional)" htmlFor="ce-min" error={err('limits')}>
                <NumberField id="ce-min" value={draft.min} allowEmpty placeholder="No minimum" onChange={(v) => set('min', v)} />
              </Field>
              <Field label="Maximum (optional)" htmlFor="ce-max">
                <NumberField id="ce-max" value={draft.max} allowEmpty placeholder="No maximum" onChange={(v) => set('max', v)} />
              </Field>
            </div>
            {startChanged && (
              <Toggle checked={resetValue} onChange={setResetValue} label="Also set the current value to the new starting value" description={`Currently at ${formatNumber(editing?.value ?? 0)}.`} />
            )}
          </Section>

          {m === 'interval' && (
            <Section title="Interval">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Count every" htmlFor="ce-int" error={err('interval')}>
                  <div className="flex gap-2">
                    <NumberField id="ce-int" value={draft.intervalAmount} onChange={(v) => set('intervalAmount', v)} className="min-w-0 flex-1" />
                    <Select
                      aria-label="Interval unit"
                      className="w-32 shrink-0"
                      value={draft.intervalUnit}
                      onChange={(u) => set('intervalUnit', u)}
                      options={[
                        { value: 'ms', label: 'milliseconds' },
                        { value: 's', label: 'seconds' },
                        { value: 'min', label: 'minutes' },
                      ]}
                    />
                  </div>
                </Field>
                <Field label="Direction">
                  <Segmented
                    ariaLabel="Direction"
                    value={draft.intervalDirection === 1 ? 'up' : 'down'}
                    onChange={(v) => set('intervalDirection', v === 'up' ? 1 : -1)}
                    options={[
                      { value: 'up', label: 'Counts up' },
                      { value: 'down', label: 'Counts down' },
                    ]}
                  />
                </Field>
              </div>
              <p className="text-[13px] text-muted">Interval counters count while Tickwell is open on screen. Browsers pause pages that are closed.</p>
            </Section>
          )}

          {m === 'score' && (
            <Section title="Players or teams">
              <NamedList items={draft.players} onChange={(v) => set('players', v)} make={(i) => newPlayer(i)} min={2} max={MAX_PLAYERS} noun="Player" />
              {err('players') && (
                <p className="text-[12.5px] text-bad" role="alert">
                  {err('players')}
                </p>
              )}
            </Section>
          )}

          {m === 'multi' && (
            <Section title="Counters on this screen">
              <NamedList items={draft.subCounters} onChange={(v) => set('subCounters', v)} make={(i) => newSubCounter(i)} min={1} max={MAX_SUBS} noun="Counter" />
              {err('subs') && (
                <p className="text-[12.5px] text-bad" role="alert">
                  {err('subs')}
                </p>
              )}
            </Section>
          )}

          <Section title="Look">
            <Field label="Colour">
              <ColorPicker value={draft.color} onChange={(v) => set('color', v)} />
            </Field>
            <Field label="Icon">
              <div className="flex flex-wrap items-center gap-2">
                {(iconsOpen ? ICON_KEYS : ICON_KEYS.slice(0, 14)).map((key) => (
                  <button
                    key={key}
                    type="button"
                    aria-label={`Icon: ${key}`}
                    aria-pressed={draft.icon === key}
                    onClick={() => set('icon', key)}
                    className={cx(
                      'grid h-10 w-10 place-items-center rounded-xl border transition-colors',
                      draft.icon === key ? 'border-accent/70 bg-accent/15 text-accent' : 'border-line/10 text-muted hover:border-line/30 hover:text-ink',
                    )}
                  >
                    <CounterIcon name={key} size={19} />
                  </button>
                ))}
                <button type="button" className="chip" onClick={() => setIconsOpen((o) => !o)}>
                  {iconsOpen ? 'Fewer' : `All ${ICON_KEYS.length} icons`}
                </button>
              </div>
            </Field>
            <Field label="Card style" hint="How this counter looks on the My Counters page.">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Card style">
                {CARD_STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={draft.cardStyle === s}
                    onClick={() => set('cardStyle', s)}
                    className={cx('rounded-xl border p-2.5 text-center text-[13px] font-medium transition-colors', draft.cardStyle === s ? 'border-accent/70 bg-accent/10' : 'border-line/10 hover:border-line/30')}
                  >
                    <span
                      className={cx('mb-2 block h-9 rounded-lg', s === 'solid' && 'bg-raised', s === 'glass' && 'border border-line/20 bg-line/10', s === 'outline' && 'border-2')}
                      style={s === 'gradient' ? { background: gradientCss(draft.color) } : s === 'outline' ? { borderColor: gradientCss(draft.color).includes('gradient') ? 'rgb(var(--accent))' : undefined } : undefined}
                    />
                    {CARD_LABEL[s]}
                  </button>
                ))}
              </div>
            </Field>
            {folders.length > 0 && (
              <Field label="Folder" htmlFor="ce-folder">
                <Select
                  id="ce-folder"
                  value={draft.folderId ?? ''}
                  onChange={(v) => set('folderId', v === '' ? null : v)}
                  options={[{ value: '', label: 'No folder' }, ...folders.map((f) => ({ value: f.id, label: f.name }))]}
                />
              </Field>
            )}
          </Section>

          {editing && (
            <p className="text-[13px] text-muted">
              Type: <strong className="font-medium text-ink">{MODE_INFO[editing.mode].name}</strong>. A counter's type is fixed once it exists so its history stays meaningful. To count in a different style, create a new counter.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}

/** The dialog for creating and editing counters. Pass options to open it, null to close. */
export function CounterEditor({ options, onClose }: { options: EditorOptions | null; onClose: () => void }) {
  // A new key for every opening resets the form.
  const key = useMemo(() => Math.random().toString(36).slice(2), [options]);
  if (!options) return null;
  return <EditorInner key={key} options={options} onClose={onClose} />;
}
