import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../core/settings';

/** A stand-in for the browser's audio, enough to see what the alarm schedules and when. */
class FakeContext {
  static last: FakeContext;
  state: 'suspended' | 'running' = 'suspended';
  currentTime = 0;
  destination = {};
  oscillators = 0;
  resumes = 0;
  constructor() {
    FakeContext.last = this;
  }
  resume() {
    this.resumes += 1;
    return Promise.resolve().then(() => {
      this.state = 'running';
    });
  }
  createGain() {
    return {
      gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} },
      connect() {},
      disconnect() {},
    };
  }
  createOscillator() {
    this.oscillators += 1;
    return { type: 'sine', frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} };
  }
  createBuffer() {
    return {};
  }
  createBufferSource() {
    return { buffer: null, connect() {}, start() {} };
  }
}

async function load() {
  vi.resetModules();
  return { alarm: await import('./alarm'), feedback: await import('./feedback') };
}

describe('alarm sound engine', () => {
  beforeEach(() => {
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  });
  afterEach(() => {
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    vi.useRealTimers();
  });

  it('wakes a suspended audio context and then schedules every note', async () => {
    const { alarm } = await load();
    const handle = alarm.startAlarm({ ...DEFAULT_SETTINGS, alarmSound: 'classic' }, 'classic', 2);
    expect(FakeContext.last.resumes).toBeGreaterThan(0);
    expect(FakeContext.last.oscillators).toBe(0); // nothing is scheduled while the clock is frozen
    await vi.waitFor(() => expect(FakeContext.last.oscillators).toBe(8)); // four beeps in each of two rounds
    handle.stop();
  });

  it('plays straight away when the context is already running', async () => {
    const { alarm, feedback } = await load();
    feedback.audio(); // creates the context
    await vi.waitFor(() => expect(FakeContext.last.state).toBe('running'));
    alarm.startAlarm(DEFAULT_SETTINGS, 'single', 3);
    expect(FakeContext.last.oscillators).toBe(3);
  });

  it('schedules nothing if it is stopped before the browser allows sound', async () => {
    vi.useFakeTimers();
    const { alarm } = await load();
    const handle = alarm.startAlarm(DEFAULT_SETTINGS, 'melody', 1);
    handle.stop();
    await vi.advanceTimersByTimeAsync(800);
    expect(FakeContext.last.oscillators).toBe(0);
  });

  it('makes no sound for the silent alarm and never touches audio', async () => {
    const { alarm } = await load();
    (window as unknown as { AudioContext: unknown }).AudioContext = class {
      constructor() {
        throw new Error('audio should not be created');
      }
    };
    expect(() => alarm.startAlarm(DEFAULT_SETTINGS, 'silent', 1)).not.toThrow();
  });

  it('reports whether sound is allowed yet', async () => {
    const { feedback } = await load();
    expect(feedback.audioStatus()).toBe('blocked'); // supported, not started
    feedback.unlockAudio();
    await Promise.resolve();
    expect(feedback.audioStatus()).toBe('running');
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
    const fresh = await load();
    expect(fresh.feedback.audioStatus()).toBe('unsupported');
  });

  it('unlocks on the first tap and then stops listening', async () => {
    const { feedback } = await load();
    const off = feedback.unlockAudioOnFirstGesture();
    window.dispatchEvent(new Event('pointerdown'));
    await Promise.resolve();
    expect(FakeContext.last.state).toBe('running');
    const before = FakeContext.last.resumes;
    window.dispatchEvent(new Event('pointerdown'));
    expect(FakeContext.last.resumes).toBe(before); // the listener removed itself
    off();
  });
});
