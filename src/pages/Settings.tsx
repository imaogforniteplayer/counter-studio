import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Database, Download, ImageIcon, Info, Keyboard, MousePointerClick, Palette, Smartphone, Trash2, Volume2, WifiOff } from 'lucide-react';
import { useDialogs, useSettings, useStore, useToast } from '../app/context';
import type { Settings } from '../core/types';
import { isHex } from '../core/colors';
import { DEFAULT_SETTINGS } from '../core/settings';
import { canVibrate, feedback, previewSound } from '../lib/feedback';
import { AlarmPicker } from '../components/AlarmPicker';
import { imageToBackgroundDataUrl } from '../lib/image';
import { useInstallPrompt } from '../lib/pwa';
import { Logo } from '../components/Logo';
import { DataSection } from '../components/settings/DataSection';
import { cx } from '../lib/cx';
import { Button, Card, ColorPicker, Kbd, PageHeader, Segmented, Select, Slider, TextInput, Toggle } from '../components/ui';

function Section({ id, title, description, icon, children }: { id: string; title: string; description?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-6">
      <header className="mb-3 flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/25 to-accent2/10 text-accent shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.25)]">{icon}</span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-semibold leading-tight tracking-tight">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{description}</p>}
        </div>
      </header>
      <Card className="divide-y divide-line/10 px-5" solid>
        {children}
      </Card>
    </section>
  );
}

/** One setting: its name and what it does on the left, the control on the right (stacked on phones). */
function Row({ label, description, children, below, wide }: { label: string; description?: ReactNode; children: ReactNode; below?: ReactNode; wide?: boolean }) {
  return (
    <div className="py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0 sm:flex-1">
          <p className="text-[14.5px] font-medium">{label}</p>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p>}
        </div>
        <div className={cx('min-w-0 sm:shrink-0', wide ? 'sm:max-w-[27rem]' : 'sm:w-60')}>{children}</div>
      </div>
      {below && <div className="mt-3">{below}</div>}
    </div>
  );
}

function parseAmounts(text: string): number[] {
  return text
    .split(/[\s,;]+/)
    .map((t) => Number(t))
    .filter((n) => Number.isFinite(n) && n >= 1 && n <= 1_000_000)
    .map((n) => Math.round(n))
    .slice(0, 6);
}

function Appearance() {
  const store = useStore();
  const toast = useToast();
  const s = useSettings();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);

  const pickImage = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const url = await imageToBackgroundDataUrl(file);
      set({ backgroundImage: url, background: 'image' });
      toast('Background image set. It stays on this device.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'That image could not be used.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section id="appearance" title="Appearance" description="Make it yours. Changes apply immediately." icon={<Palette size={19} />}>
      <Row label="Theme" wide>
        <Segmented
          ariaLabel="Theme"
          value={s.theme}
          onChange={(theme) => set({ theme })}
          options={[
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
            { value: 'system', label: 'Match device' },
          ]}
        />
      </Row>

      <Row label="Accent colour" description="Used for buttons, highlights and progress." wide>
        <ColorPicker label="Accent colour" value={s.customAccent ?? s.palette} onChange={(v) => (isHex(v) ? set({ customAccent: v }) : set({ palette: v, customAccent: null }))} />
      </Row>

      <Row
        label="Background"
        below={
          s.background !== 'color' && s.background !== 'image' ? undefined : (
          <>
            {s.background === 'color' && (
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Background colour"
                  value={isHex(s.backgroundColor) ? s.backgroundColor : DEFAULT_SETTINGS.backgroundColor}
                  onChange={(e) => set({ backgroundColor: e.target.value })}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-line/20 bg-transparent p-1"
                />
                <span className="text-sm text-muted tabular-nums">{s.backgroundColor}</span>
              </div>
            )}
            {s.background === 'image' && (
              <div className="flex flex-wrap items-center gap-2">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" aria-label="Choose a background picture" onChange={(e) => void pickImage(e.target.files?.[0])} />
                <Button icon={<ImageIcon size={16} />} loading={busy} onClick={() => fileRef.current?.click()}>
                  {s.backgroundImage ? 'Choose another picture…' : 'Choose a picture…'}
                </Button>
                {s.backgroundImage && (
                  <Button variant="ghost" icon={<Trash2 size={15} />} onClick={() => set({ backgroundImage: null, background: 'aurora' })}>
                    Remove
                  </Button>
                )}
                <p className="w-full text-[12.5px] text-muted">The picture is shrunk and stored only in this browser. It is never uploaded.</p>
              </div>
            )}
          </>
          )
        }
      >
        <Select
          aria-label="Background style"
          value={s.background}
          onChange={(background) => set({ background })}
          options={[
            { value: 'aurora', label: 'Soft glow' },
            { value: 'dusk', label: 'Dusk gradient' },
            { value: 'grid', label: 'Fine grid' },
            { value: 'color', label: 'Solid colour' },
            { value: 'image', label: 'My picture' },
            { value: 'none', label: 'Plain' },
          ]}
        />
      </Row>

      <Row label="Number font">
        <Select
          aria-label="Number font"
          value={s.numberFont}
          onChange={(numberFont) => set({ numberFont })}
          options={[
            { value: 'sans', label: 'Clean sans' },
            { value: 'rounded', label: 'Rounded' },
            { value: 'mono', label: 'Monospace' },
            { value: 'serif', label: 'Serif' },
            { value: 'condensed', label: 'Condensed' },
          ]}
        />
      </Row>
      <Row label="Number size" description="How big the count appears.">
        <Slider label="Number size" compact value={s.numberScale} min={0.6} max={1.5} step={0.05} onChange={(numberScale) => set({ numberScale })} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Button shape" description="The shape of the big count button.">
        <Select
          aria-label="Button shape"
          value={s.buttonStyle}
          onChange={(buttonStyle) => set({ buttonStyle })}
          options={[
            { value: 'round', label: 'Round' },
            { value: 'soft', label: 'Soft square' },
            { value: 'pill', label: 'Pill' },
            { value: 'square', label: 'Square' },
          ]}
        />
      </Row>
      <Row label="Counter card style" description="Used for new counters.">
        <Select
          aria-label="Default counter card style"
          value={s.defaultCardStyle}
          onChange={(defaultCardStyle) => set({ defaultCardStyle })}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'glass', label: 'Glass' },
            { value: 'outline', label: 'Outline' },
            { value: 'gradient', label: 'Gradient' },
          ]}
        />
      </Row>

      <Toggle checked={s.compact} onChange={(compact) => set({ compact })} label="Compact layout" description="Tighter spacing, so more fits on screen." />
      <Toggle
        checked={s.animations === 'full'}
        onChange={(on) => set({ animations: on ? 'full' : 'reduced' })}
        label="Animations"
        description="Number rolls, page transitions and celebrations."
      />
      <Toggle
        checked={s.followSystemMotion}
        onChange={(followSystemMotion) => set({ followSystemMotion })}
        label="Respect my device's “reduce motion” setting"
        description="Recommended. Animations turn off automatically if your device asks for less motion."
      />
    </Section>
  );
}

function Counting() {
  const store = useStore();
  const dialogs = useDialogs();
  const s = useSettings();
  const [amounts, setAmounts] = useState(s.quickAmounts.join(', '));
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);

  const commitAmounts = () => {
    const list = parseAmounts(amounts);
    const next = list.length ? list : DEFAULT_SETTINGS.quickAmounts;
    set({ quickAmounts: [...next] });
    setAmounts(next.join(', '));
  };

  return (
    <Section id="counting" title="Counting" description="How taps, holds and keys behave." icon={<MousePointerClick size={19} />}>
      <Toggle checked={s.holdToCount} onChange={(holdToCount) => set({ holdToCount })} label="Hold to keep counting" description="Hold the plus or minus button to count repeatedly." />
      {s.holdToCount && (
        <Row label="Hold speed" description="How fast it repeats while you hold.">
          <Slider label="Hold speed" compact value={s.holdSpeed} min={0.5} max={3} step={0.25} onChange={(holdSpeed) => set({ holdSpeed })} format={(v) => `${v}×`} />
        </Row>
      )}
      <Row label="Quick-add amounts" description="Up to six whole numbers, separated by commas. They appear under the main buttons.">
        <TextInput id="quick-amounts" aria-label="Quick-add amounts" value={amounts} onChange={setAmounts} onBlur={commitAmounts} onKeyDown={(e) => e.key === 'Enter' && commitAmounts()} inputMode="numeric" />
      </Row>
      <Toggle checked={s.shortcuts} onChange={(shortcuts) => set({ shortcuts })} label="Keyboard shortcuts" description="Space or ↑ to add, ↓ to subtract, Z to undo, F for full screen." />
      <Row label="All shortcuts" description="See every key you can use.">
        <Button className="w-full sm:w-auto" icon={<Keyboard size={15} />} onClick={() => dialogs.openShortcuts()}>
          Show shortcuts <Kbd>?</Kbd>
        </Button>
      </Row>
    </Section>
  );
}

function SoundSection() {
  const store = useStore();
  const s = useSettings();
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const vibrate = canVibrate();

  return (
    <Section id="sound" title="Sound and touch" description="Counter sounds are off until you switch them on. Timer and countdown alarms have their own sound." icon={<Volume2 size={19} />}>
      <Toggle checked={s.soundEnabled} onChange={(soundEnabled) => set({ soundEnabled })} label="Sounds" description="A short sound for taps, limits and goals." />
      {s.soundEnabled && (
        <>
          <Row label="Sound">
            <Select
              aria-label="Sound"
              value={s.soundPreset}
              onChange={(soundPreset) => set({ soundPreset })}
              options={[
                { value: 'click', label: 'Click' },
                { value: 'tick', label: 'Tick' },
                { value: 'pop', label: 'Pop' },
                { value: 'chime', label: 'Chime' },
              ]}
            />
          </Row>
          <Row label="Volume">
            <Slider label="Volume" compact value={s.soundVolume} min={0} max={1} step={0.05} onChange={(soundVolume) => set({ soundVolume })} format={(v) => `${Math.round(v * 100)}%`} />
          </Row>
          <Row label="Pitch">
            <Slider label="Pitch" compact value={s.soundPitch} min={0.5} max={2} step={0.05} onChange={(soundPitch) => set({ soundPitch })} format={(v) => `${v.toFixed(2)}×`} />
          </Row>
          <Row label="Try it" description="Hear your settings.">
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <Button size="sm" icon={<Volume2 size={15} />} onClick={() => previewSound(s, 'tap')}>
                Preview tap
              </Button>
              <Button size="sm" onClick={() => previewSound(s, 'done')}>
                Preview goal reached
              </Button>
            </div>
          </Row>
        </>
      )}
      <Row label="Timer and alarm sound" description="Plays when a timer or a countdown counter ends. It works even when counter sounds are off. Pick a quiet one for tests, or Silent for screen and vibration only." wide>
        <div className="sm:w-[24rem] max-w-full">
          <AlarmPicker settings={s} onChange={(alarmSound) => set({ alarmSound })} />
        </div>
      </Row>
      <Row label="Alarm volume">
        <Slider label="Alarm volume" compact value={s.alarmVolume} min={0.05} max={1} step={0.05} onChange={(alarmVolume) => set({ alarmVolume })} format={(v) => `${Math.round(v * 100)}%`} />
      </Row>
      <Row label="Alarm repeats" description="How many times the sound plays.">
        <Slider label="Alarm repeats" compact value={s.alarmRepeats} min={1} max={10} step={1} onChange={(alarmRepeats) => set({ alarmRepeats })} format={(v) => `${v}×`} />
      </Row>
      <Toggle
        checked={s.haptics}
        onChange={(haptics) => {
          set({ haptics });
          if (haptics) feedback({ ...s, haptics: true, soundEnabled: false }, 'tap');
        }}
        label="Vibration"
        description={vibrate ? 'A light buzz when you count.' : "This browser or device does not support vibration, so this has no effect here. (iPhones and iPads do not allow it in web apps.)"}
      />
    </Section>
  );
}

function InstallSection() {
  const { canInstall, installed, install, isIos } = useInstallPrompt();
  const offline = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  return (
    <Section id="install" title="Install and offline" description="Tickwell is a web app that works without a connection." icon={<Smartphone size={19} />}>
      <div className="flex items-start gap-3 py-4 text-sm text-muted">
        <WifiOff size={17} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
        <p>
          {offline
            ? 'After your first visit the app is saved in your browser and opens even with no internet. Your counters never leave this device.'
            : 'This browser does not support offline apps, so a connection is needed to open Tickwell. Your counters are still stored on this device.'}
        </p>
      </div>
      <div className="py-4">
        {installed ? (
          <p className="text-sm font-medium text-good">Installed on this device.</p>
        ) : canInstall ? (
          <Button variant="primary" icon={<Download size={16} />} onClick={() => void install()}>
            Install Tickwell
          </Button>
        ) : isIos ? (
          <p className="text-sm text-muted">
            On iPhone or iPad: tap the Share button in Safari, then <strong className="text-ink">Add to Home Screen</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted">If your browser supports it, look for an install icon in the address bar or an “Install app” item in the browser menu.</p>
        )}
      </div>
    </Section>
  );
}

const SECTIONS: [string, string][] = [
  ['appearance', 'Appearance'],
  ['counting', 'Counting'],
  ['sound', 'Sound'],
  ['install', 'Install'],
  ['data', 'Data and backups'],
  ['about', 'About'],
];

function jump(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function SettingsPage() {
  const [active, setActive] = useState('appearance');

  // Highlight the section you are reading.
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const watcher = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: '-12% 0px -70% 0px' },
    );
    for (const [id] of SECTIONS) {
      const el = document.getElementById(id);
      if (el) watcher.observe(el);
    }
    return () => watcher.disconnect();
  }, []);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Settings" subtitle="Everything here is saved on this device." />
      <div className="lg:grid lg:grid-cols-[12.5rem_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2 lg:hidden">
          {SECTIONS.map(([id, label]) => (
            <button key={id} type="button" className="chip" data-active={active === id} onClick={() => jump(id)}>
              {label}
            </button>
          ))}
        </nav>
        <nav aria-label="Settings sections" className="hidden lg:sticky lg:top-6 lg:block lg:self-start">
          <ul className="space-y-1">
            {SECTIONS.map(([id, label]) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => jump(id)}
                  aria-current={active === id ? 'true' : undefined}
                  className={cx(
                    'flex h-10 w-full items-center rounded-xl px-3 text-left text-[14px] font-medium transition-[color,background-color,box-shadow] duration-200',
                    active === id ? 'bg-gradient-to-r from-accent/20 to-accent/5 text-ink shadow-[inset_0_0_0_1px_rgb(var(--accent)/0.22)]' : 'text-muted hover:bg-line/10 hover:text-ink',
                  )}
                >
                  {label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-10 pb-10">
          <Appearance />
          <Counting />
          <SoundSection />
          <InstallSection />
          <Section id="data" title="Data and backups" description="You own your data. Tickwell has no accounts and no cloud, so backups are how you move or protect it." icon={<Database size={19} />}>
            <div className="py-5">
              <DataSection />
            </div>
          </Section>
          <Section id="about" title="About Tickwell" icon={<Info size={19} />}>
            <div className="flex items-start gap-4 py-5">
              <Logo size={48} className="shrink-0" />
              <div className="space-y-2 text-sm leading-relaxed text-muted">
                <p>Tickwell is a free, open-source counter app. It is local-first: everything is stored in this browser, nothing is sent to a server, and there is no tracking.</p>
                <p>Sharing makes a link or QR code that contains the counter's settings. Counters do not sync between devices on their own. To move your data, use a backup file.</p>
                <p>Interval counters add up while the page is open. If the page is closed, they catch up the time that passed only when it is open again, and never count in the background.</p>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
