import type { AlarmSound, Settings } from '../core/types';
import { audio, buzz } from './feedback';

interface Note {
  type: OscillatorType;
  from: number;
  to?: number;
  /** Seconds after the start of one round. */
  at: number;
  length: number;
  gain: number;
  /** Seconds to fade in. Soft sounds use a slower fade so they do not startle. */
  attack?: number;
}

interface Pattern {
  notes: Note[];
  /** Seconds from the start of one round to the start of the next. */
  cycle: number;
  /** Vibration for one round, where the device supports it. */
  buzz: number[];
}

function beeps(type: OscillatorType, hz: number, count: number, gap: number, length: number, gain: number): Note[] {
  return Array.from({ length: count }, (_, i) => ({ type, from: hz, at: i * gap, length, gain }));
}

const PATTERNS: Record<AlarmSound, Pattern> = {
  softbell: {
    notes: [
      { type: 'sine', from: 880, at: 0, length: 1.5, gain: 0.5, attack: 0.006 },
      { type: 'sine', from: 1760, at: 0, length: 1, gain: 0.14, attack: 0.006 },
      { type: 'sine', from: 2640, at: 0, length: 0.55, gain: 0.05, attack: 0.006 },
    ],
    cycle: 1.8,
    buzz: [60],
  },
  gentle: {
    notes: [
      { type: 'sine', from: 523.25, at: 0, length: 0.7, gain: 0.4, attack: 0.15 },
      { type: 'sine', from: 659.25, at: 0.5, length: 0.9, gain: 0.4, attack: 0.15 },
    ],
    cycle: 1.8,
    buzz: [60, 80, 60],
  },
  single: {
    notes: [{ type: 'sine', from: 1000, at: 0, length: 0.28, gain: 0.45, attack: 0.012 }],
    cycle: 1,
    buzz: [80],
  },
  nudge: {
    notes: [
      { type: 'triangle', from: 698.46, at: 0, length: 0.28, gain: 0.42, attack: 0.02 },
      { type: 'triangle', from: 880, at: 0.24, length: 0.5, gain: 0.42, attack: 0.02 },
    ],
    cycle: 1.3,
    buzz: [50, 70, 50],
  },
  silent: { notes: [], cycle: 1.3, buzz: [200, 120, 200] },
  classic: { notes: beeps('square', 1200, 4, 0.2, 0.12, 0.32), cycle: 1.3, buzz: [120, 80, 120, 80, 120, 80, 120] },
  digital: {
    notes: [...beeps('square', 2200, 3, 0.18, 0.09, 0.28), { type: 'square', from: 2200, at: 0.62, length: 0.4, gain: 0.28 }],
    cycle: 1.5,
    buzz: [90, 70, 90, 70, 90, 70, 300],
  },
  rising: {
    notes: [
      { type: 'sine', from: 400, to: 1200, at: 0, length: 0.5, gain: 0.5, attack: 0.03 },
      { type: 'sine', from: 500, to: 1500, at: 0.6, length: 0.5, gain: 0.5, attack: 0.03 },
    ],
    cycle: 1.5,
    buzz: [150, 100, 250],
  },
  melody: {
    notes: [
      { type: 'triangle', from: 523.25, at: 0, length: 0.26, gain: 0.5, attack: 0.01 },
      { type: 'triangle', from: 659.25, at: 0.2, length: 0.26, gain: 0.5, attack: 0.01 },
      { type: 'triangle', from: 783.99, at: 0.4, length: 0.26, gain: 0.5, attack: 0.01 },
      { type: 'triangle', from: 1046.5, at: 0.6, length: 0.7, gain: 0.5, attack: 0.01 },
    ],
    cycle: 1.6,
    buzz: [80, 60, 80, 60, 80, 60, 260],
  },
  siren: {
    notes: [
      { type: 'sawtooth', from: 600, to: 1000, at: 0, length: 0.6, gain: 0.5, attack: 0.02 },
      { type: 'sawtooth', from: 1000, to: 600, at: 0.6, length: 0.6, gain: 0.5, attack: 0.02 },
    ],
    cycle: 1.3,
    buzz: [400, 100, 400],
  },
};

export interface AlarmHandle {
  /** Seconds the alarm will keep going if it is not stopped. */
  seconds: number;
  stop: () => void;
}

let current: AlarmHandle | null = null;

/** Stop whatever alarm is sounding right now. */
export function stopAlarm(): void {
  current?.stop();
  current = null;
}

/**
 * Play an alarm. Every round is scheduled on the audio clock, so the timing stays right even if the page is
 * in a background tab. Alarms ignore the counter-sound switch because a timer that ends silently is not
 * much of a timer; choose "Silent" to turn the sound off.
 */
export function startAlarm(settings: Settings, sound: AlarmSound = settings.alarmSound, repeats: number = settings.alarmRepeats): AlarmHandle {
  stopAlarm();
  const pattern = PATTERNS[sound];
  const rounds = Math.max(1, Math.min(10, Math.round(repeats)));
  const seconds = pattern.cycle * rounds;
  const vibrate = settings.haptics || sound === 'silent';

  const timers: number[] = [];
  if (vibrate) {
    for (let i = 0; i < rounds; i++) timers.push(window.setTimeout(() => buzz(pattern.buzz), i * pattern.cycle * 1000));
  }

  let master: GainNode | null = null;
  const ac = pattern.notes.length > 0 ? audio() : null;
  if (ac) {
    master = ac.createGain();
    master.gain.value = Math.max(0, Math.min(1, settings.alarmVolume)) * 0.7;
    master.connect(ac.destination);
    const start = ac.currentTime + 0.03;
    for (let round = 0; round < rounds; round++) {
      for (const n of pattern.notes) {
        const t = start + round * pattern.cycle + n.at;
        const osc = ac.createOscillator();
        const env = ac.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.from, t);
        if (n.to) osc.frequency.exponentialRampToValueAtTime(n.to, t + n.length);
        env.gain.setValueAtTime(0.0001, t);
        env.gain.exponentialRampToValueAtTime(n.gain, t + (n.attack ?? 0.005));
        env.gain.exponentialRampToValueAtTime(0.0001, t + n.length);
        osc.connect(env);
        env.connect(master);
        osc.start(t);
        osc.stop(t + n.length + 0.05);
      }
    }
  }

  const handle: AlarmHandle = {
    seconds,
    stop: () => {
      timers.forEach((t) => window.clearTimeout(t));
      if (master && ac) {
        try {
          master.gain.cancelScheduledValues(ac.currentTime);
          master.gain.setTargetAtTime(0, ac.currentTime, 0.02);
          window.setTimeout(() => master?.disconnect(), 200);
        } catch {
          /* the sound is already over */
        }
      }
      try {
        if (vibrate && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(0);
      } catch {
        /* vibration is optional */
      }
    },
  };
  current = handle;
  return handle;
}

/** One round of a sound, for the preview buttons. */
export function previewAlarm(settings: Settings, sound: AlarmSound): AlarmHandle {
  return startAlarm(settings, sound, 1);
}
