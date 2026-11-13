import type { Settings } from '../core/types';

/** What just happened. Sounds and vibration are chosen from this. */
export type FeedbackKind = 'tap' | 'dec' | 'limit' | 'done' | 'reset';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

interface Voice {
  type: OscillatorType;
  from: number;
  to?: number;
  at: number;
  length: number;
  gain: number;
}

function voices(preset: Settings['soundPreset'], kind: FeedbackKind): Voice[] {
  if (kind === 'limit') return [{ type: 'sawtooth', from: 150, to: 110, at: 0, length: 0.16, gain: 0.5 }];
  if (kind === 'done') {
    return [
      { type: 'sine', from: 784, at: 0, length: 0.2, gain: 0.8 },
      { type: 'sine', from: 1047, at: 0.12, length: 0.22, gain: 0.8 },
      { type: 'sine', from: 1568, at: 0.26, length: 0.4, gain: 0.7 },
    ];
  }
  const low = kind === 'dec' || kind === 'reset' ? 0.78 : 1;
  switch (preset) {
    case 'tick':
      return [{ type: 'sine', from: 1900 * low, at: 0, length: 0.035, gain: 0.7 }];
    case 'pop':
      return [{ type: 'sine', from: 380 * low, to: 920 * low, at: 0, length: 0.09, gain: 0.8 }];
    case 'chime':
      return [{ type: 'triangle', from: 988 * low, at: 0, length: 0.28, gain: 0.7 }];
    case 'click':
    default:
      return [{ type: 'square', from: 1250 * low, to: 800 * low, at: 0, length: 0.03, gain: 0.35 }];
  }
}

function play(settings: Settings, kind: FeedbackKind): void {
  const ac = audio();
  if (!ac) return;
  const master = ac.createGain();
  master.gain.value = Math.max(0, Math.min(1, settings.soundVolume)) * 0.6;
  master.connect(ac.destination);
  const now = ac.currentTime;
  for (const v of voices(settings.soundPreset, kind)) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = v.type;
    const pitch = settings.soundPitch;
    osc.frequency.setValueAtTime(v.from * pitch, now + v.at);
    if (v.to) osc.frequency.exponentialRampToValueAtTime(v.to * pitch, now + v.at + v.length);
    gain.gain.setValueAtTime(0.0001, now + v.at);
    gain.gain.exponentialRampToValueAtTime(v.gain, now + v.at + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + v.at + v.length);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now + v.at);
    osc.stop(now + v.at + v.length + 0.05);
  }
}

function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(pattern);
  } catch {
    /* vibration is optional */
  }
}

export function canVibrate(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/** Play the sound and vibration the person has switched on for this event. */
export function feedback(settings: Settings, kind: FeedbackKind): void {
  if (settings.soundEnabled) play(settings, kind);
  if (settings.haptics) {
    if (kind === 'limit') buzz([18, 40, 18]);
    else if (kind === 'done') buzz([40, 60, 40, 60, 120]);
    else if (kind === 'reset') buzz(20);
    else buzz(8);
  }
}

/** Play a sound even if sounds are switched off, for the Settings preview button. */
export function previewSound(settings: Settings, kind: FeedbackKind = 'tap'): void {
  play(settings, kind);
}

/** Beep for timers and alarms in Tools. Independent of the counter sound settings. */
export function beep(settings: Settings, times = 1): void {
  for (let i = 0; i < times; i++) {
    window.setTimeout(() => play({ ...settings, soundPreset: 'chime', soundVolume: Math.max(0.4, settings.soundVolume) }, 'tap'), i * 260);
  }
  if (settings.haptics) buzz(times > 1 ? [120, 80, 120, 80, 200] : 120);
}
