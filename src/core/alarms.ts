import type { AlarmSound } from './types';

export type AlarmGroup = 'quiet' | 'standard' | 'loud';

export interface AlarmInfo {
  id: AlarmSound;
  name: string;
  /** One line shown next to the name. */
  blurb: string;
  group: AlarmGroup;
}

export const ALARM_GROUP_LABELS: Record<AlarmGroup, string> = {
  quiet: 'Quiet: good for tests and classrooms',
  standard: 'Standard',
  loud: 'Loud',
};

/**
 * Every alarm sound, in the order they are listed. The quiet group is meant for exams, libraries and
 * classrooms: short, soft and not startling. "Silent" makes no sound at all and only flashes the screen and
 * vibrates where the device allows it.
 */
export const ALARM_SOUNDS: readonly AlarmInfo[] = [
  { id: 'softbell', name: 'Soft bell', blurb: 'One gentle bell that fades away.', group: 'quiet' },
  { id: 'gentle', name: 'Gentle tone', blurb: 'Two slow, soft notes.', group: 'quiet' },
  { id: 'single', name: 'Single beep', blurb: 'One short, quiet beep.', group: 'quiet' },
  { id: 'nudge', name: 'Two-note nudge', blurb: 'A light, friendly reminder.', group: 'quiet' },
  { id: 'silent', name: 'Silent (screen and vibration only)', blurb: 'No sound. The screen flashes and the device vibrates if it can.', group: 'quiet' },
  { id: 'classic', name: 'Classic alarm', blurb: 'Four quick beeps, like an alarm clock.', group: 'standard' },
  { id: 'digital', name: 'Digital watch', blurb: 'Three short beeps and a long one.', group: 'standard' },
  { id: 'rising', name: 'Rising tones', blurb: 'Two sweeps that climb upward.', group: 'standard' },
  { id: 'melody', name: 'Cheerful melody', blurb: 'A short, bright four-note tune.', group: 'standard' },
  { id: 'siren', name: 'Loud siren', blurb: 'A strong rising and falling siren. Hard to miss.', group: 'loud' },
];

export const ALARM_IDS = ALARM_SOUNDS.map((a) => a.id) as [AlarmSound, ...AlarmSound[]];

export function alarmInfo(id: AlarmSound): AlarmInfo {
  return ALARM_SOUNDS.find((a) => a.id === id) ?? ALARM_SOUNDS[0]!;
}
