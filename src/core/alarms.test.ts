import { describe, expect, it } from 'vitest';
import { ALARM_GROUP_LABELS, ALARM_IDS, ALARM_SOUNDS, alarmInfo } from './alarms';
import { DEFAULT_SETTINGS, sanitizeSettings } from './settings';

describe('alarm sounds', () => {
  it('offers exactly ten, each with a unique id and a name', () => {
    expect(ALARM_SOUNDS.length).toBe(10);
    expect(new Set(ALARM_IDS).size).toBe(10);
    for (const a of ALARM_SOUNDS) {
      expect(a.name.length > 0).toBe(true);
      expect(a.blurb.length > 0).toBe(true);
    }
  });

  it('includes quiet choices for tests, among them a silent one', () => {
    const quiet = ALARM_SOUNDS.filter((a) => a.group === 'quiet');
    expect(quiet.length >= 4).toBe(true);
    expect(quiet.some((a) => a.id === 'silent')).toBe(true);
    expect(ALARM_GROUP_LABELS.quiet.toLowerCase().includes('tests')).toBe(true);
  });

  it('also has louder choices for noisy places', () => {
    expect(ALARM_SOUNDS.some((a) => a.group === 'loud')).toBe(true);
  });

  it('looks a sound up by id', () => {
    expect(alarmInfo('siren').group).toBe('loud');
    expect(alarmInfo('single').name).toBe('Single beep');
  });
});

describe('alarm settings', () => {
  it('defaults to a gentle sound at a moderate volume', () => {
    expect(DEFAULT_SETTINGS.alarmSound).toBe('softbell');
    expect(alarmInfo(DEFAULT_SETTINGS.alarmSound).group).toBe('quiet');
    expect(DEFAULT_SETTINGS.alarmRepeats).toBe(3);
  });

  it('keeps a valid saved sound', () => {
    expect(sanitizeSettings({ alarmSound: 'siren' }).alarmSound).toBe('siren');
  });

  it('replaces an unknown sound with the default', () => {
    expect(sanitizeSettings({ alarmSound: 'dubstep' }).alarmSound).toBe('softbell');
    expect(sanitizeSettings({ alarmSound: 7 }).alarmSound).toBe('softbell');
  });

  it('keeps volume and repeats in range, and repeats whole', () => {
    const s = sanitizeSettings({ alarmVolume: 9, alarmRepeats: 99 });
    expect(s.alarmVolume).toBe(1);
    expect(s.alarmRepeats).toBe(10);
    expect(sanitizeSettings({ alarmRepeats: 0 }).alarmRepeats).toBe(1);
    expect(sanitizeSettings({ alarmRepeats: 2.6 }).alarmRepeats).toBe(3);
  });

  it('fills the alarm settings in for backups made before they existed', () => {
    const s = sanitizeSettings({ theme: 'light' });
    expect(s.alarmSound).toBe('softbell');
    expect(s.alarmVolume).toBe(0.7);
  });
});
