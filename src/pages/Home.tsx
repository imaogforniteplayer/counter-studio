import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { LayoutTemplate, Plus, Sparkles, X } from 'lucide-react';
import { useAppState, useDialogs, useStore } from '../app/context';
import { currentCounter, liveCounters, recentlyUsed } from '../app/selectors';
import type { Counter } from '../core/types';
import { CounterIcon } from '../lib/icons';
import { navigate } from '../lib/router';
import { cx } from '../lib/cx';
import { Button, EmptyState, IconButton } from '../components/ui';
import { GroupStage } from '../components/home/GroupStage';
import { MoreControls } from '../components/home/MoreControls';
import { SingleStage } from '../components/home/SingleStage';
import { Switcher } from '../components/home/Switcher';
import { Toolbar } from '../components/home/Toolbar';
import { stageVars, describeCounter, isSingleValue, tileStyle } from '../components/home/shared';
import { useAutoCount } from '../components/home/useAutoCount';
import { useCounting } from '../components/home/useCounting';
import { useFullscreen } from '../components/home/useFullscreen';
import type { FullscreenControl } from '../components/home/useFullscreen';
import { useCountingShortcuts } from '../components/home/useShortcuts';
import { useWakeLock } from '../components/home/useWakeLock';

function EmptyHome() {
  const store = useStore();
  const dialogs = useDialogs();
  return (
    <div className="mx-auto max-w-lg pt-6 sm:pt-16">
      <EmptyState
        icon={<Sparkles size={28} />}
        title="Let's start counting"
        description="Make a counter in a few seconds. Everything stays on this device, and there is nothing to sign up for."
      >
        <Button
          variant="primary"
          size="lg"
          onClick={() => {
            const c = store.addCounter({ name: 'My counter' });
            store.selectCounter(c.id);
          }}
        >
          Start a simple counter
        </Button>
        <Button size="lg" icon={<Plus size={17} />} onClick={() => dialogs.openEditor({})}>
          Choose a type
        </Button>
        <Button size="lg" variant="ghost" icon={<LayoutTemplate size={17} />} onClick={() => navigate('/templates')}>
          Browse templates
        </Button>
      </EmptyState>
    </div>
  );
}

/** Announces the value to screen readers, a moment after the last change so fast taps do not flood. */
function useSpoken(text: string): string {
  const [spoken, setSpoken] = useState(text);
  useEffect(() => {
    const t = window.setTimeout(() => setSpoken(text), 450);
    return () => window.clearTimeout(t);
  }, [text]);
  return spoken;
}

function Dashboard({ counter, live, fullscreen }: { counter: Counter; live: Counter[]; fullscreen: FullscreenControl }) {
  const store = useStore();
  const counting = useCounting(counter.id);
  const auto = useAutoCount(counter.id, counting);
  const spoken = useSpoken(describeCounter(counter));
  const recent = useMemo(() => recentlyUsed(live, 9).filter((c) => c.id !== counter.id).slice(0, 8), [live, counter.id]);
  useWakeLock(auto.running || fullscreen.active);

  const step = (delta: -1 | 1) => {
    if (live.length < 2) return;
    const at = live.findIndex((c) => c.id === counter.id);
    store.selectCounter(live[(at + delta + live.length) % live.length].id);
  };
  useCountingShortcuts({ counter, counting, auto, fullscreen, onStep: step });

  const stageProps = { counter, counting, auto, full: fullscreen.active };
  const body = isSingleValue(counter.mode) ? <SingleStage {...stageProps} /> : <GroupStage {...stageProps} />;
  const vars = stageVars(counter.color);

  const stage = fullscreen.active ? (
    createPortal(
      <div
        className="fixed inset-0 z-[55] flex flex-col overflow-y-auto bg-[rgb(var(--bg))]"
        style={{ ...vars, backgroundImage: 'radial-gradient(60% 50% at 50% 0%, rgb(var(--accent) / 0.2), transparent 70%)' }}
        role="region"
        aria-label={`${counter.name}, full screen`}
      >
        <div className="flex items-center justify-end p-3 safe-top">
          <IconButton label="Exit full screen (Esc)" icon={<X size={20} />} variant="secondary" onClick={fullscreen.exit} />
        </div>
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-4 pb-10">
          {body}
          <Toolbar counter={counter} fullscreen={fullscreen} />
        </div>
      </div>,
      document.body,
    )
  ) : (
    <section className="card relative px-4 py-7 sm:px-6 sm:py-9" style={vars} aria-label={counter.name}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 rounded-t-2xl opacity-60" style={{ background: 'radial-gradient(60% 100% at 50% 0%, rgb(var(--accent) / 0.16), transparent 75%)' }} aria-hidden="true" />
      <div className="relative">
        {body}
        <div className="mt-8">
          <Toolbar counter={counter} fullscreen={fullscreen} />
        </div>
      </div>
    </section>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </div>
      <Switcher counters={live} current={counter} onPrev={() => step(-1)} onNext={() => step(1)} />
      {stage}
      <MoreControls counter={counter} counting={counting} auto={auto} />
      {recent.length > 0 && (
        <section aria-label="Recently used counters">
          <h2 className="eyebrow mb-2.5">Recently used</h2>
          <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {recent.map((c) => (
              <button key={c.id} type="button" className={cx('chip shrink-0 py-1.5 pl-1.5 pr-3.5 text-ink')} onClick={() => store.selectCounter(c.id)}>
                <span className="grid h-6 w-6 place-items-center rounded-full" style={tileStyle(c.color)}>
                  <CounterIcon name={c.icon} size={13} />
                </span>
                {c.name}
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default function HomePage() {
  const state = useAppState();
  const live = useMemo(() => liveCounters(state.counters), [state.counters]);
  const counter = currentCounter(state.counters, state.settings.lastCounterId);
  const fullscreen = useFullscreen();

  // Leave full screen if the counter it was showing disappears.
  const none = counter === null;
  useEffect(() => {
    if (none && fullscreen.active) fullscreen.exit();
  }, [none, fullscreen]);

  if (!counter) return <EmptyHome />;
  return <Dashboard key={counter.id} counter={counter} live={live} fullscreen={fullscreen} />;
}
