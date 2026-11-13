import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Download, ImageIcon, Keyboard, Trash2, Volume2, WifiOff } from 'lucide-react';
import { useDialogs, useSettings, useStore, useToast } from '../app/context';
import type { Settings } from '../core/types';
import { isHex } from '../core/colors';
import { DEFAULT_SETTINGS } from '../core/settings';
import { canVibrate, feedback, previewSound } from '../lib/feedback';
import { imageToBackgroundDataUrl } from '../lib/image';
import { useInstallPrompt } from '../lib/pwa';
import { Logo } from '../components/Logo';
import { DataSection } from '../components/settings/DataSection';
import { Button, Card, ColorPicker, Field, Kbd, PageHeader, Segmented, Select, Slider, TextInput, Toggle } from '../components/ui';

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="scroll-mt-20">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
      <Card className="mt-3 space-y-5 p-5" solid>
        {children}
      </Card>
    </section>
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
    <Section id="appearance" title="Appearance" description="Make it yours. Changes apply immediately.">
      <Field label="Theme">
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
      </Field>

      <ColorPicker label="Accent colour" value={s.customAccent ?? s.palette} onChange={(v) => (isHex(v) ? set({ customAccent: v }) : set({ palette: v, customAccent: null }))} />

      <Field label="Background">
        <div className="space-y-3">
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
        </div>
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Number font">
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
        </Field>
        <Field label="Button shape">
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
        </Field>
        <Field label="Counter card style" hint="Used for new counters.">
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
        </Field>
        <div className="sm:pt-6">
          <Slider label="Number size" value={s.numberScale} min={0.6} max={1.5} step={0.05} onChange={(numberScale) => set({ numberScale })} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
      </div>

      <div className="space-y-4 border-t border-line/10 pt-5">
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
      </div>
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
    <Section id="counting" title="Counting" description="How taps, holds and keys behave.">
      <Toggle checked={s.holdToCount} onChange={(holdToCount) => set({ holdToCount })} label="Hold to keep counting" description="Hold the plus or minus button to count repeatedly." />
      {s.holdToCount && (
        <Slider label="Hold speed" value={s.holdSpeed} min={0.5} max={3} step={0.25} onChange={(holdSpeed) => set({ holdSpeed })} format={(v) => `${v}×`} />
      )}
      <Field label="Quick-add amounts" htmlFor="quick-amounts" hint="Up to six whole numbers, separated by commas. These appear under the main buttons.">
        <TextInput id="quick-amounts" value={amounts} onChange={setAmounts} onBlur={commitAmounts} onKeyDown={(e) => e.key === 'Enter' && commitAmounts()} inputMode="numeric" />
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line/10 pt-5">
        <Toggle checked={s.shortcuts} onChange={(shortcuts) => set({ shortcuts })} label="Keyboard shortcuts" description="Space or ↑ to add, ↓ to subtract, Z to undo, F for full screen." />
        <Button size="sm" icon={<Keyboard size={15} />} onClick={() => dialogs.openShortcuts()}>
          See all <Kbd>?</Kbd>
        </Button>
      </div>
    </Section>
  );
}

function SoundSection() {
  const store = useStore();
  const s = useSettings();
  const set = (patch: Partial<Settings>) => store.updateSettings(patch);
  const vibrate = canVibrate();

  return (
    <Section id="sound" title="Sound and touch" description="Optional feedback while you count. Sound is off until you switch it on.">
      <Toggle checked={s.soundEnabled} onChange={(soundEnabled) => set({ soundEnabled })} label="Sounds" description="A short sound for taps, limits and goals." />
      {s.soundEnabled && (
        <div className="space-y-5">
          <Field label="Sound">
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
          </Field>
          <Slider label="Volume" value={s.soundVolume} min={0} max={1} step={0.05} onChange={(soundVolume) => set({ soundVolume })} format={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Pitch" value={s.soundPitch} min={0.5} max={2} step={0.05} onChange={(soundPitch) => set({ soundPitch })} format={(v) => `${v.toFixed(2)}×`} />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<Volume2 size={15} />} onClick={() => previewSound(s, 'tap')}>
              Preview tap
            </Button>
            <Button size="sm" onClick={() => previewSound(s, 'done')}>
              Preview goal reached
            </Button>
          </div>
        </div>
      )}
      <div className="border-t border-line/10 pt-5">
        <Toggle
          checked={s.haptics}
          onChange={(haptics) => {
            set({ haptics });
            if (haptics) feedback({ ...s, haptics: true, soundEnabled: false }, 'tap');
          }}
          label="Vibration"
          description={vibrate ? 'A light buzz when you count.' : "This browser or device does not support vibration, so this has no effect here. (iPhones and iPads do not allow it in web apps.)"}
        />
      </div>
    </Section>
  );
}

function InstallSection() {
  const { canInstall, installed, install, isIos } = useInstallPrompt();
  const offline = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  return (
    <Section id="install" title="Install and offline" description="Tickwell is a web app that works without a connection.">
      <p className="flex items-start gap-2.5 text-sm text-muted">
        <WifiOff size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
        {offline
          ? 'After your first visit the app is saved in your browser and opens even with no internet. Your counters never leave this device.'
          : 'This browser does not support offline apps, so a connection is needed to open Tickwell. Your counters are still stored on this device.'}
      </p>
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
        <p className="text-sm text-muted">
          If your browser supports it, look for an install icon in the address bar or an “Install app” item in the browser menu.
        </p>
      )}
    </Section>
  );
}

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Settings" subtitle="Everything here is saved on this device." />
      <nav aria-label="Settings sections" className="mb-6 flex flex-wrap gap-2">
        {[
          ['appearance', 'Appearance'],
          ['counting', 'Counting'],
          ['sound', 'Sound'],
          ['install', 'Install'],
          ['data', 'Data and backups'],
          ['about', 'About'],
        ].map(([id, label]) => (
          <a key={id} href={`#/settings`} className="chip" onClick={(e) => {
            e.preventDefault();
            document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}>
            {label}
          </a>
        ))}
      </nav>
      <div className="space-y-10 pb-10">
        <Appearance />
        <Counting />
        <SoundSection />
        <InstallSection />
        <Section id="data" title="Data and backups" description="You own your data. Tickwell has no accounts and no cloud, so backups are how you move or protect it.">
          <DataSection />
        </Section>
        <Section id="about" title="About Tickwell">
          <div className="flex items-start gap-4">
            <Logo size={48} />
            <div className="space-y-2 text-sm text-muted">
              <p>
                Tickwell is a free, open-source counter app. It is local-first: everything is stored in this browser, nothing is sent to a server, and there is no tracking.
              </p>
              <p>
                Sharing makes a link or QR code that contains the counter's settings. Counters do not sync between devices on their own. To move your data, use a backup file.
              </p>
              <p>
                Interval counters add up while the page is open. If the page is closed, they catch up the time that passed only when it is open again, and never count in the background.
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
