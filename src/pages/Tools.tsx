import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Calculator, Clapperboard, Coins, Dices, Hash, Hourglass, Shuffle, Timer as TimerIcon, Copy, Flag, Pause, Play, RotateCcw, BellOff, SkipForward, Target } from 'lucide-react';
import { useAppState, useSettings, useStore, useToast } from '../app/context';
import { liveCounters } from '../app/selectors';
import { formatDuration, formatNumber } from '../core/format';
import {
  DEFAULT_FOCUS_PLAN,
  MAX_DICE,
  MAX_SIDES,
  addLap,
  addTap,
  bpmFromTaps,
  focusSessionsDone,
  focusStep,
  focusTimeDone,
  formatDice,
  lapExtremes,
  pace,
  parseDiceNotation,
  randomInt,
  rollDice,
  sanitizeFocusPlan,
  secureRandom,
  shuffle,
  toMs,
} from '../core/tools';
import type { DiceRoll, DiceSpec, FocusPlan, Lap } from '../core/tools';
import { startAlarm, stopAlarm } from '../lib/alarm';
import type { AlarmHandle } from '../lib/alarm';
import { AlarmPicker } from '../components/AlarmPicker';
import { alarmInfo } from '../core/alarms';
import { copyText } from '../lib/files';
import { navigate, useRoute } from '../lib/router';
import { cx } from '../lib/cx';
import { Badge, Button, Card, Field, PageHeader, Segmented, Select, TextArea, TextInput, Toggle } from '../components/ui';

type ToolId = 'stopwatch' | 'timer' | 'focus' | 'dice' | 'coin' | 'number' | 'picker' | 'tempo' | 'pace';

const TOOLS: { id: ToolId; name: string; icon: ReactNode }[] = [
  { id: 'stopwatch', name: 'Stopwatch', icon: <TimerIcon size={17} /> },
  { id: 'timer', name: 'Timer', icon: <Hourglass size={17} /> },
  { id: 'focus', name: 'Focus', icon: <Target size={17} /> },
  { id: 'dice', name: 'Dice', icon: <Dices size={17} /> },
  { id: 'coin', name: 'Coin flip', icon: <Coins size={17} /> },
  { id: 'number', name: 'Random number', icon: <Hash size={17} /> },
  { id: 'picker', name: 'Picker', icon: <Shuffle size={17} /> },
  { id: 'tempo', name: 'Tap tempo', icon: <Clapperboard size={17} /> },
  { id: 'pace', name: 'Pace', icon: <Calculator size={17} /> },
];

/** Re-renders on a timer while `active`. */
function useTick(active: boolean, ms = 50): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
  return now;
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Card className="mx-auto max-w-xl space-y-5 p-5 sm:p-6" solid>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted">{description}</p>
      </div>
      {children}
    </Card>
  );
}

function BigReadout({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <p className="rounded-2xl border border-line/15 bg-raised py-6 text-center text-[clamp(2.5rem,12vw,4.25rem)] font-semibold leading-none tracking-tight tabular-nums" aria-label={label}>
      {children}
    </p>
  );
}

function toInt(text: string, fallback = 0): number {
  const n = Number(text);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

/* ---------------- stopwatch ---------------- */

function Stopwatch() {
  const toast = useToast();
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [before, setBefore] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const running = startedAt !== null;
  const now = useTick(running);
  const elapsed = before + (startedAt === null ? 0 : Math.max(0, now - startedAt));
  const { fastest, slowest } = lapExtremes(laps);

  const toggle = () => {
    if (running) {
      setBefore(before + Date.now() - (startedAt ?? Date.now()));
      setStartedAt(null);
    } else setStartedAt(Date.now());
  };
  const reset = () => {
    setStartedAt(null);
    setBefore(0);
    setLaps([]);
  };
  const lap = () => setLaps((l) => addLap(l, startedAt === null ? before : before + Date.now() - startedAt));
  const copyLaps = async () => {
    const text = laps.map((l) => `Lap ${l.n}\t${formatDuration(l.split, true)}\t${formatDuration(l.total, true)}`).join('\n');
    toast((await copyText(text)) ? 'Laps copied.' : 'Copying is blocked in this browser.', 'info');
  };

  return (
    <Panel title="Stopwatch" description="Time anything, with laps. It keeps correct time even if the tab is in the background.">
      <BigReadout label={`Elapsed ${formatDuration(elapsed, true)}`}>{formatDuration(elapsed, true)}</BigReadout>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Button variant="primary" size="lg" icon={running ? <Pause size={18} /> : <Play size={18} />} onClick={toggle} className="col-span-2 sm:col-span-1">
          {running ? 'Pause' : elapsed > 0 ? 'Resume' : 'Start'}
        </Button>
        <Button size="lg" icon={<Flag size={17} />} onClick={lap} disabled={elapsed === 0}>
          Lap
        </Button>
        <Button size="lg" icon={<RotateCcw size={17} />} onClick={reset} disabled={elapsed === 0 && laps.length === 0}>
          Reset
        </Button>
      </div>
      {laps.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="eyebrow">Laps</h3>
            <Button size="sm" variant="ghost" icon={<Copy size={14} />} onClick={() => void copyLaps()}>
              Copy
            </Button>
          </div>
          <ol className="max-h-72 divide-y divide-line/10 overflow-y-auto rounded-xl border border-line/15 text-sm tabular-nums">
            {[...laps].reverse().map((l) => (
              <li key={l.n} className="flex items-center justify-between gap-3 px-4 py-2">
                <span className="text-muted">Lap {l.n}</span>
                <span className={cx(l.n === fastest && 'text-good', l.n === slowest && 'text-bad')}>
                  {formatDuration(l.split, true)}
                  {l.n === fastest && <span className="ml-1.5 text-[11px]">fastest</span>}
                  {l.n === slowest && <span className="ml-1.5 text-[11px]">slowest</span>}
                </span>
                <span className="text-muted">{formatDuration(l.total, true)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- timer ---------------- */

function CountdownTimer() {
  const settings = useSettings();
  const [h, setH] = useState('0');
  const [m, setM] = useState('5');
  const [s, setS] = useState('0');
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null); // paused time left
  const [total, setTotal] = useState(0);
  const [finished, setFinished] = useState(false);
  const [ringing, setRinging] = useState(false);
  const store = useStore();
  const running = endAt !== null;
  const now = useTick(running, 100);
  const remaining = running ? Math.max(0, endAt - now) : left ?? toMs(toInt(h), toInt(m), toInt(s));
  const ring = useRef<{ handle: AlarmHandle; timer: number } | null>(null);

  const silence = () => {
    if (ring.current) window.clearTimeout(ring.current.timer);
    ring.current = null;
    stopAlarm();
    setRinging(false);
  };
  // Leaving the page stops the alarm.
  useEffect(() => silence, []);

  useEffect(() => {
    if (running && remaining <= 0) {
      setEndAt(null);
      setLeft(0);
      setFinished(true);
      const handle = startAlarm(settings);
      setRinging(true);
      ring.current = { handle, timer: window.setTimeout(() => setRinging(false), handle.seconds * 1000 + 300) };
    }
  }, [running, remaining, settings]);

  const start = () => {
    silence();
    const ms = left && left > 0 ? left : toMs(toInt(h), toInt(m), toInt(s));
    if (ms <= 0) return;
    setTotal((t) => (left && left > 0 ? t : ms));
    setFinished(false);
    setEndAt(Date.now() + ms);
    setLeft(null);
  };
  const pause = () => {
    if (endAt !== null) setLeft(Math.max(0, endAt - Date.now()));
    setEndAt(null);
  };
  const reset = () => {
    silence();
    setEndAt(null);
    setLeft(null);
    setFinished(false);
  };
  const editing = !running && left === null;
  const preset = (min: number) => {
    reset();
    setH(String(Math.floor(min / 60)));
    setM(String(min % 60));
    setS('0');
  };
  const pct = total > 0 && !editing ? Math.min(100, ((total - remaining) / total) * 100) : 0;

  return (
    <Panel title="Timer" description="Count down from a time you choose. Your alarm sound plays when it ends, and the screen shows that time is up.">
      <BigReadout label={`Time left ${formatDuration(remaining)}`}>{formatDuration(remaining)}</BigReadout>
      <div className="h-1.5 overflow-hidden rounded-full bg-line/10" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)))' }} />
      </div>
      {finished && (
        <div className={ringing ? 'alarm-pulse flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-good/40 bg-good/10 px-4 py-3' : 'flex flex-wrap items-center justify-center gap-3 px-4 py-3'}>
          <p className="text-[16px] font-semibold text-good" role="status">
            Time is up!
          </p>
          {ringing && (
            <Button size="sm" variant="danger" icon={<BellOff size={15} />} onClick={silence}>
              Stop alarm
            </Button>
          )}
        </div>
      )}
      {editing && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Hours" htmlFor="t-h">
              <TextInput id="t-h" type="number" inputMode="numeric" min={0} max={99} value={h} onChange={setH} />
            </Field>
            <Field label="Minutes" htmlFor="t-m">
              <TextInput id="t-m" type="number" inputMode="numeric" min={0} max={59} value={m} onChange={setM} />
            </Field>
            <Field label="Seconds" htmlFor="t-s">
              <TextInput id="t-s" type="number" inputMode="numeric" min={0} max={59} value={s} onChange={setS} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {[1, 5, 10, 25, 45, 60].map((min) => (
              <button key={min} type="button" className="chip" onClick={() => preset(min)}>
                {min} min
              </button>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">Alarm sound</p>
            <AlarmPicker settings={settings} onChange={(alarmSound) => store.updateSettings({ alarmSound })} />
            {alarmInfo(settings.alarmSound).group === 'quiet' && <p className="mt-2 text-[12.5px] text-muted">A quiet choice, suited to tests and classrooms.</p>}
          </div>
        </>
      )}
      <div className="flex gap-2">
        {running ? (
          <Button variant="primary" size="lg" icon={<Pause size={18} />} onClick={pause} className="flex-1">
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon={<Play size={18} />} onClick={start} className="flex-1" disabled={remaining <= 0}>
            {left !== null && left > 0 ? 'Resume' : 'Start'}
          </Button>
        )}
        <Button size="lg" icon={<RotateCcw size={17} />} onClick={reset} disabled={editing && !finished}>
          Reset
        </Button>
      </div>
    </Panel>
  );
}

/* ---------------- focus intervals ---------------- */

const FOCUS_KEY = 'tickwell.focusPlan';
const FOCUS_PRESETS: { label: string; plan: FocusPlan }[] = [
  { label: '25 / 5', plan: DEFAULT_FOCUS_PLAN },
  { label: '50 / 10', plan: { focusMin: 50, shortMin: 10, longMin: 30, sessions: 3 } },
  { label: '90 / 20', plan: { focusMin: 90, shortMin: 20, longMin: 30, sessions: 2 } },
];

function loadFocusPlan(): FocusPlan {
  try {
    return sanitizeFocusPlan(JSON.parse(window.localStorage.getItem(FOCUS_KEY) ?? '{}'));
  } catch {
    return DEFAULT_FOCUS_PLAN;
  }
}

function saveFocusPlan(plan: FocusPlan): void {
  try {
    window.localStorage.setItem(FOCUS_KEY, JSON.stringify(plan));
  } catch {
    /* A plan that is not remembered is fine. */
  }
}

const PHASE_NAME = { focus: 'Focus', short: 'Short break', long: 'Long break' } as const;

function FocusTimer() {
  const settings = useSettings();
  const store = useStore();
  const toast = useToast();
  const { counters } = useAppState();
  const [fields, setFields] = useState(() => {
    const p = loadFocusPlan();
    return { focusMin: String(p.focusMin), shortMin: String(p.shortMin), longMin: String(p.longMin), sessions: String(p.sessions) };
  });
  const draft = sanitizeFocusPlan(fields);
  const [locked, setLocked] = useState<FocusPlan | null>(null); // the plan this run started with
  const [step, setStep] = useState(0);
  const [endAt, setEndAt] = useState<number | null>(null);
  const [left, setLeft] = useState<number | null>(null);
  const [auto, setAuto] = useState(true);
  const [countId, setCountId] = useState('');
  const [ringing, setRinging] = useState(false);
  const ring = useRef<number | null>(null);

  const plan = locked ?? draft;
  const current = focusStep(plan, step);
  const running = endAt !== null;
  const started = locked !== null;
  const now = useTick(running, 250);
  const remaining = running ? Math.max(0, endAt - now) : left ?? current.ms;

  const silence = () => {
    if (ring.current !== null) window.clearTimeout(ring.current);
    ring.current = null;
    stopAlarm();
    setRinging(false);
  };
  // Leaving the page stops the alarm.
  useEffect(() => silence, []);

  const countable = liveCounters(counters).filter((c) => c.mode !== 'score' && c.mode !== 'multi' && c.mode !== 'countdown' && c.mode !== 'interval');
  const countTarget = countable.find((c) => c.id === countId);

  // A step is over: ring, count the finished focus session, and move on.
  useEffect(() => {
    if (!running || remaining > 0) return;
    const next = focusStep(plan, step + 1);
    if (current.phase === 'focus' && countTarget) {
      const result = store.bump(countTarget.id, 1);
      if (result?.locked) toast(`“${countTarget.name}” is locked, so this session was not counted.`);
    }
    const handle = startAlarm(settings, undefined, Math.min(settings.alarmRepeats, 2));
    setRinging(true);
    ring.current = window.setTimeout(() => setRinging(false), handle.seconds * 1000 + 300);
    toast(current.phase === 'focus' ? `Focus session done. ${PHASE_NAME[next.phase]} next.` : 'Break over. Time to focus.', 'success');
    setStep(step + 1);
    if (auto) {
      setEndAt(Date.now() + next.ms);
    } else {
      setEndAt(null);
      setLeft(null);
    }
  }, [running, remaining, plan, step, current.phase, countTarget, auto, settings, store, toast]);

  const start = () => {
    silence();
    if (!locked) {
      saveFocusPlan(draft);
      setLocked(draft);
    }
    setEndAt(Date.now() + (left && left > 0 ? left : current.ms));
    setLeft(null);
  };
  const pause = () => {
    if (endAt !== null) setLeft(Math.max(0, endAt - Date.now()));
    setEndAt(null);
  };
  const skip = () => {
    silence();
    const next = focusStep(plan, step + 1);
    setStep(step + 1);
    setLeft(null);
    setEndAt(running ? Date.now() + next.ms : null);
  };
  const reset = () => {
    silence();
    setLocked(null);
    setStep(0);
    setEndAt(null);
    setLeft(null);
  };
  const applyPreset = (p: FocusPlan) =>
    setFields({ focusMin: String(p.focusMin), shortMin: String(p.shortMin), longMin: String(p.longMin), sessions: String(p.sessions) });

  const done = focusSessionsDone(step);
  const focused = focusTimeDone(plan, step, current.ms - remaining);
  const pct = current.ms > 0 ? Math.min(100, ((current.ms - remaining) / current.ms) * 100) : 0;
  const resting = current.phase !== 'focus';
  const field = (key: keyof FocusPlan, label: string, id: string, max: number) => (
    <Field label={label} htmlFor={id}>
      <TextInput id={id} type="number" inputMode="numeric" min={1} max={max} value={fields[key]} onChange={(v) => setFields((f) => ({ ...f, [key]: v }))} />
    </Field>
  );

  return (
    <Panel title="Focus" description="Work in timed sessions with breaks in between. Your alarm sound marks every change, and each finished session can add one to a counter.">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Badge tone={resting ? 'good' : 'accent'}>{PHASE_NAME[current.phase]}</Badge>
        <span className="text-[13px] text-muted">
          Session {current.session} of {plan.sessions}
          {current.set > 1 ? `, set ${current.set}` : ''}
        </span>
      </div>
      <BigReadout label={`${PHASE_NAME[current.phase]}, ${formatDuration(remaining)} left`}>{formatDuration(remaining)}</BigReadout>
      <div className="h-1.5 overflow-hidden rounded-full bg-line/10" aria-hidden="true">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, rgb(var(--accent)), rgb(var(--accent2)))' }} />
      </div>
      {ringing && (
        <div className="alarm-pulse flex flex-wrap items-center justify-center gap-3 rounded-2xl border border-good/40 bg-good/10 px-4 py-3">
          <p className="text-[15px] font-semibold text-good" role="status">
            {resting ? 'Focus session finished.' : 'Break finished.'}
          </p>
          <Button size="sm" variant="danger" icon={<BellOff size={15} />} onClick={silence}>
            Stop alarm
          </Button>
        </div>
      )}
      {started && (
        <p className="text-center text-[13px] text-muted">
          {done} {done === 1 ? 'session' : 'sessions'} finished, {formatDuration(focused)} focused
          {countTarget ? `, counting on “${countTarget.name}”` : ''}
        </p>
      )}
      {!started && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {field('focusMin', 'Focus (min)', 'f-focus', 180)}
            {field('shortMin', 'Short break', 'f-short', 60)}
            {field('longMin', 'Long break', 'f-long', 120)}
            {field('sessions', 'Sessions per set', 'f-sessions', 8)}
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Presets">
            {FOCUS_PRESETS.map((p) => (
              <button key={p.label} type="button" className="chip" onClick={() => applyPreset(p.plan)}>
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
      <div className="space-y-3">
        <Field label="Count finished sessions on" htmlFor="f-counter">
          <Select
            id="f-counter"
            value={countTarget ? countTarget.id : ''}
            onChange={setCountId}
            options={[{ value: '', label: 'No counter' }, ...countable.map((c) => ({ value: c.id, label: c.name }))]}
          />
        </Field>
        <Toggle checked={auto} onChange={setAuto} label="Start the next step automatically" description="Turn this off to wait for you after every alarm." />
        {!started && (
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-muted">Alarm sound</p>
            <AlarmPicker settings={settings} onChange={(alarmSound) => store.updateSettings({ alarmSound })} />
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_auto_auto]">
        {running ? (
          <Button variant="primary" size="lg" icon={<Pause size={18} />} onClick={pause} className="col-span-2 sm:col-span-1">
            Pause
          </Button>
        ) : (
          <Button variant="primary" size="lg" icon={<Play size={18} />} onClick={start} className="col-span-2 sm:col-span-1">
            {left !== null && left > 0 ? 'Resume' : started ? 'Start next' : 'Start'}
          </Button>
        )}
        <Button size="lg" icon={<SkipForward size={17} />} onClick={skip} disabled={!started} aria-label="Skip to the next step">
          Skip
        </Button>
        <Button size="lg" icon={<RotateCcw size={17} />} onClick={reset} disabled={!started}>
          Reset
        </Button>
      </div>
    </Panel>
  );
}

/* ---------------- dice ---------------- */

function DiceTool() {
  const [count, setCount] = useState('2');
  const [sides, setSides] = useState('6');
  const [mod, setMod] = useState('0');
  const [notation, setNotation] = useState('');
  const [notationError, setNotationError] = useState<string | null>(null);
  const [roll, setRoll] = useState<DiceRoll | null>(null);
  const [log, setLog] = useState<DiceRoll[]>([]);

  const spec: DiceSpec = { count: toInt(count, 1), sides: toInt(sides, 6), modifier: toInt(mod) };
  const valid = spec.count >= 1 && spec.count <= MAX_DICE && spec.sides >= 2 && spec.sides <= MAX_SIDES;

  const go = (s: DiceSpec) => {
    const r = rollDice(s);
    setRoll(r);
    setLog((l) => [r, ...l].slice(0, 10));
  };
  const goNotation = () => {
    const parsed = parseDiceNotation(notation);
    if (!parsed) {
      setNotationError(`Use a form like 2d6+3 or d20 (up to ${MAX_DICE} dice, ${MAX_SIDES} sides).`);
      return;
    }
    setNotationError(null);
    setCount(String(parsed.count));
    setSides(String(parsed.sides));
    setMod(String(parsed.modifier));
    go(parsed);
  };

  return (
    <Panel title="Dice" description="Roll any number of dice with any number of sides.">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Common dice">
        {[4, 6, 8, 10, 12, 20, 100].map((n) => (
          <button key={n} type="button" className="chip" onClick={() => go({ count: 1, sides: n, modifier: 0 })}>
            d{n}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Dice" htmlFor="d-count">
          <TextInput id="d-count" type="number" inputMode="numeric" min={1} max={MAX_DICE} value={count} onChange={setCount} />
        </Field>
        <Field label="Sides" htmlFor="d-sides">
          <TextInput id="d-sides" type="number" inputMode="numeric" min={2} max={MAX_SIDES} value={sides} onChange={setSides} />
        </Field>
        <Field label="Modifier" htmlFor="d-mod">
          <TextInput id="d-mod" type="number" inputMode="numeric" value={mod} onChange={setMod} />
        </Field>
      </div>
      <Button variant="primary" size="lg" full icon={<Dices size={18} />} onClick={() => go(spec)} disabled={!valid}>
        Roll {valid ? formatDice(spec) : ''}
      </Button>
      <Field label="Or type notation" htmlFor="d-notation" error={notationError}>
        <TextInput id="d-notation" value={notation} onChange={setNotation} placeholder="e.g. 3d8+2" onKeyDown={(e) => e.key === 'Enter' && goNotation()} />
      </Field>
      {roll && (
        <div role="status" aria-live="polite" className="space-y-2 text-center">
          <BigReadout label={`Total ${roll.total}`}>{formatNumber(roll.total)}</BigReadout>
          <p className="text-sm text-muted tabular-nums">
            {formatDice(roll.spec)}
            {roll.rolls.length > 1 || roll.spec.modifier !== 0 ? `: ${roll.rolls.join(' + ')}${roll.spec.modifier ? ` ${roll.spec.modifier > 0 ? '+' : '−'} ${Math.abs(roll.spec.modifier)}` : ''}` : ''}
          </p>
        </div>
      )}
      {log.length > 1 && (
        <p className="text-[13px] text-muted">
          Recent: {log.slice(1).map((r) => `${r.total}`).join(', ')}
        </p>
      )}
    </Panel>
  );
}

/* ---------------- coin ---------------- */

function Coin() {
  const [result, setResult] = useState<'Heads' | 'Tails' | null>(null);
  const [tally, setTally] = useState({ Heads: 0, Tails: 0 });
  const [flips, setFlips] = useState(0);
  const flip = () => {
    const r = secureRandom() < 0.5 ? 'Heads' : 'Tails';
    setResult(r);
    setFlips((n) => n + 1);
    setTally((t) => ({ ...t, [r]: t[r] + 1 }));
  };
  return (
    <Panel title="Coin flip" description="A fair flip, using your device's secure random source.">
      <div className="grid place-items-center py-2">
        <div key={flips} className="coin grid h-36 w-36 place-items-center rounded-full text-xl font-semibold shadow-soft" style={{ background: 'linear-gradient(135deg, rgb(var(--accent)), rgb(var(--accent2)))', color: 'rgb(var(--onaccent))' }} role="status" aria-live="polite">
          {result ?? 'Flip me'}
        </div>
      </div>
      <Button variant="primary" size="lg" full icon={<Coins size={18} />} onClick={flip}>
        Flip
      </Button>
      <p className="text-center text-sm text-muted tabular-nums">
        Heads {tally.Heads} · Tails {tally.Tails}
        {flips > 0 && (
          <>
            {' · '}
            <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => { setTally({ Heads: 0, Tails: 0 }); setFlips(0); setResult(null); }}>
              Reset
            </button>
          </>
        )}
      </p>
    </Panel>
  );
}

/* ---------------- random number ---------------- */

function RandomNumber() {
  const [min, setMin] = useState('1');
  const [max, setMax] = useState('100');
  const [n, setN] = useState<number | null>(null);
  const lo = toInt(min, 1);
  const hi = toInt(max, 100);
  const ok = Math.abs(lo) <= 1e9 && Math.abs(hi) <= 1e9;
  return (
    <Panel title="Random number" description="A whole number between two values, both included.">
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" htmlFor="r-min">
          <TextInput id="r-min" type="number" inputMode="numeric" value={min} onChange={setMin} />
        </Field>
        <Field label="To" htmlFor="r-max" error={ok ? null : 'Use numbers up to a billion.'}>
          <TextInput id="r-max" type="number" inputMode="numeric" value={max} onChange={setMax} />
        </Field>
      </div>
      <Button variant="primary" size="lg" full icon={<Hash size={18} />} disabled={!ok} onClick={() => setN(randomInt(lo, hi))}>
        Generate
      </Button>
      {n !== null && (
        <div role="status" aria-live="polite">
          <BigReadout>{formatNumber(n)}</BigReadout>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- picker ---------------- */

function Picker() {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [order, setOrder] = useState<string[] | null>(null);
  const items = text.split('\n').map((l) => l.trim()).filter(Boolean);
  return (
    <Panel title="Picker" description="One name per line. Pick a winner, or shuffle the whole list into a random order.">
      <Field label="Items" htmlFor="pick-items" hint={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}>
        <TextArea id="pick-items" value={text} onChange={setText} rows={6} placeholder={'Ava\nBen\nChloe'} />
      </Field>
      <div className="flex gap-2">
        <Button variant="primary" size="lg" className="flex-1" icon={<Shuffle size={17} />} disabled={items.length < 1} onClick={() => { setOrder(null); setPicked(items[randomInt(0, items.length - 1)]); }}>
          Pick one
        </Button>
        <Button size="lg" disabled={items.length < 2} onClick={() => { setPicked(null); setOrder(shuffle(items)); }}>
          Shuffle all
        </Button>
      </div>
      {picked !== null && (
        <div role="status" aria-live="polite">
          <BigReadout>
            <span className="break-words text-[clamp(1.75rem,8vw,2.75rem)]">{picked}</span>
          </BigReadout>
        </div>
      )}
      {order && (
        <ol className="list-decimal space-y-1 rounded-xl border border-line/15 py-3 pl-9 pr-4 text-sm" aria-label="Shuffled order">
          {order.map((o, i) => (
            <li key={`${o}-${i}`}>{o}</li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

/* ---------------- tap tempo ---------------- */

function TapTempo() {
  const [taps, setTaps] = useState<number[]>([]);
  const bpm = bpmFromTaps(taps);
  return (
    <Panel title="Tap tempo" description="Tap the button in time with a beat to measure beats per minute. Press Space or Enter while it is focused.">
      <BigReadout label={bpm === null ? 'No tempo yet' : `${bpm} beats per minute`}>{bpm === null ? '–' : bpm}</BigReadout>
      <p className="-mt-2 text-center text-[13px] text-muted">{bpm === null ? 'Tap at least twice' : `beats per minute · ${taps.length} taps`}</p>
      <button
        type="button"
        className="btn btn-primary h-28 w-full select-none text-xl"
        onPointerDown={(e) => {
          if (e.pointerType === 'mouse' && e.button !== 0) return;
          setTaps((t) => addTap(t, performance.now()));
        }}
        onKeyDown={(e) => {
          if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
            e.preventDefault();
            setTaps((t) => addTap(t, performance.now()));
          }
        }}
      >
        Tap
      </button>
      <Button icon={<RotateCcw size={16} />} onClick={() => setTaps([])} disabled={taps.length === 0}>
        Start over
      </Button>
    </Panel>
  );
}

/* ---------------- pace ---------------- */

function dateValue(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function PaceCalc() {
  const [target, setTarget] = useState('1000');
  const [current, setCurrent] = useState('0');
  const [deadline, setDeadline] = useState(() => dateValue(Date.now() + 30 * 86_400_000));
  const t = Number(target);
  const c = Number(current);
  const when = /^\d{4}-\d{2}-\d{2}$/.test(deadline) ? new Date(`${deadline}T23:59:59`).getTime() : NaN;
  const inputsOk = Number.isFinite(t) && Number.isFinite(c) && t > 0 && c >= 0 && Number.isFinite(when);
  const result = inputsOk ? pace(t, c, when, Date.now()) : null;
  return (
    <Panel title="Pace" description="Work out how much to count each day to reach a goal by a date.">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="Goal" htmlFor="p-t">
          <TextInput id="p-t" type="number" inputMode="decimal" min={0} value={target} onChange={setTarget} />
        </Field>
        <Field label="So far" htmlFor="p-c">
          <TextInput id="p-c" type="number" inputMode="decimal" min={0} value={current} onChange={setCurrent} />
        </Field>
        <Field label="By (end of day)" htmlFor="p-d">
          <TextInput id="p-d" type="date" value={deadline} onChange={setDeadline} />
        </Field>
      </div>
      {!result ? (
        <p className="text-sm text-muted">Enter a goal above zero, how far you are, and a date.</p>
      ) : result.done ? (
        <p className="rounded-xl border border-good/30 px-4 py-3 text-[15px] font-medium text-good" role="status">
          You have already reached the goal.
        </p>
      ) : result.overdue ? (
        <p className="rounded-xl border border-bad/30 px-4 py-3 text-[15px] font-medium text-bad" role="status">
          That date has passed, and {formatNumber(result.remaining)} to go. Pick a later date.
        </p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-center" role="status" aria-live="polite">
          {[
            ['Per day', result.perDay],
            ['Per week', result.perWeek],
            ['Left to count', result.remaining],
            ['Days left', result.daysLeft],
          ].map(([label, v]) => (
            <div key={label as string} className="rounded-xl border border-line/15 bg-raised px-3 py-3">
              <dd className="text-2xl font-semibold tabular-nums">{formatNumber(v as number)}</dd>
              <dt className="text-[12.5px] text-muted">{label}</dt>
            </div>
          ))}
        </dl>
      )}
    </Panel>
  );
}

/* ---------------- page ---------------- */

export default function ToolsPage() {
  const route = useRoute();
  const asked = route.query.get('tool');
  const tool: ToolId = TOOLS.some((t) => t.id === asked) ? (asked as ToolId) : 'stopwatch';
  const ref = useRef<HTMLDivElement>(null);
  const pick = (id: ToolId) => navigate('/tools', { tool: id }, { replace: true });

  return (
    <div className="pb-10">
      <PageHeader title="Tools" subtitle="Small helpers that work alongside your counters. Nothing here leaves your device." />
      <div className="mx-auto mb-6 grid max-w-xl grid-cols-2 gap-2 sm:grid-cols-3" role="tablist" aria-label="Tools">
        {TOOLS.map((t) => (
          <button key={t.id} id={`tool-tab-${t.id}`} type="button" role="tab" aria-selected={tool === t.id} aria-controls="tool-panel" data-active={tool === t.id} className="chip w-full justify-center gap-2 max-sm:last:col-span-2" onClick={() => pick(t.id)}>
            {t.icon}
            {t.name}
          </button>
        ))}
      </div>
      <div ref={ref} id="tool-panel" role="tabpanel" aria-labelledby={`tool-tab-${tool}`}>
        {tool === 'stopwatch' && <Stopwatch />}
        {tool === 'timer' && <CountdownTimer />}
        {tool === 'focus' && <FocusTimer />}
        {tool === 'dice' && <DiceTool />}
        {tool === 'coin' && <Coin />}
        {tool === 'number' && <RandomNumber />}
        {tool === 'picker' && <Picker />}
        {tool === 'tempo' && <TapTempo />}
        {tool === 'pace' && <PaceCalc />}
      </div>
    </div>
  );
}
