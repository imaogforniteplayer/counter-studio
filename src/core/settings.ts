import type { Settings } from './types';
import { isHex, findSwatch } from './colors';
import { arr, bool, isRecord, num, oneOf, str } from './sanitize';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  palette: 'ember',
  customAccent: null,
  background: 'aurora',
  backgroundColor: '#14141a',
  backgroundImage: null,
  numberFont: 'sans',
  numberScale: 1,
  buttonStyle: 'round',
  defaultCardStyle: 'solid',
  animations: 'full',
  followSystemMotion: true,
  compact: false,
  soundEnabled: false,
  soundPreset: 'click',
  soundVolume: 0.5,
  soundPitch: 1,
  haptics: true,
  holdToCount: true,
  holdSpeed: 1,
  shortcuts: true,
  countersView: 'grid',
  onboardingDone: false,
  lastCounterId: null,
  quickAmounts: [1, 5, 10, 100],
};

/** Largest background image we are willing to keep in local storage (as a data URL). */
export const MAX_BACKGROUND_IMAGE_CHARS = 1_800_000;

export function sanitizeSettings(raw: unknown): Settings {
  const d = DEFAULT_SETTINGS;
  if (!isRecord(raw)) return { ...d, quickAmounts: [...d.quickAmounts] };

  const quick = arr(raw.quickAmounts, 6)
    .map((n) => (typeof n === 'number' && Number.isFinite(n) && n > 0 && n <= 1_000_000 ? Math.round(n) : null))
    .filter((n): n is number => n !== null && n > 0);

  const image =
    typeof raw.backgroundImage === 'string' &&
    raw.backgroundImage.startsWith('data:image/') &&
    raw.backgroundImage.length <= MAX_BACKGROUND_IMAGE_CHARS
      ? raw.backgroundImage
      : null;

  const palette = typeof raw.palette === 'string' && findSwatch(raw.palette) ? raw.palette : d.palette;

  return {
    theme: oneOf(raw.theme, ['dark', 'light', 'system'] as const, d.theme),
    palette,
    customAccent: isHex(raw.customAccent) ? raw.customAccent : null,
    background: oneOf(raw.background, ['none', 'aurora', 'grid', 'dusk', 'color', 'image'] as const, d.background),
    backgroundColor: isHex(raw.backgroundColor) ? raw.backgroundColor : d.backgroundColor,
    backgroundImage: image,
    numberFont: oneOf(raw.numberFont, ['sans', 'mono', 'serif', 'rounded', 'condensed'] as const, d.numberFont),
    numberScale: num(raw.numberScale, d.numberScale, 0.6, 1.5),
    buttonStyle: oneOf(raw.buttonStyle, ['round', 'soft', 'pill', 'square'] as const, d.buttonStyle),
    defaultCardStyle: oneOf(raw.defaultCardStyle, ['solid', 'glass', 'outline', 'gradient'] as const, d.defaultCardStyle),
    animations: oneOf(raw.animations, ['full', 'reduced'] as const, d.animations),
    followSystemMotion: bool(raw.followSystemMotion, d.followSystemMotion),
    compact: bool(raw.compact, d.compact),
    soundEnabled: bool(raw.soundEnabled, d.soundEnabled),
    soundPreset: oneOf(raw.soundPreset, ['click', 'tick', 'pop', 'chime'] as const, d.soundPreset),
    soundVolume: num(raw.soundVolume, d.soundVolume, 0, 1),
    soundPitch: num(raw.soundPitch, d.soundPitch, 0.5, 2),
    haptics: bool(raw.haptics, d.haptics),
    holdToCount: bool(raw.holdToCount, d.holdToCount),
    holdSpeed: num(raw.holdSpeed, d.holdSpeed, 0.5, 3),
    shortcuts: bool(raw.shortcuts, d.shortcuts),
    countersView: oneOf(raw.countersView, ['grid', 'list'] as const, d.countersView),
    onboardingDone: bool(raw.onboardingDone, d.onboardingDone),
    lastCounterId: raw.lastCounterId === null ? null : str(raw.lastCounterId, 60) || null,
    quickAmounts: quick.length ? quick : [...d.quickAmounts],
  };
}
