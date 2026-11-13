import { useEffect, useState } from 'react';
import type { Settings } from '../core/types';
import { resolveColor, rgbVar } from '../core/colors';
import type { RGB } from '../core/colors';

function channel(v: number): number {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function luminance([r, g, b]: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a: number, b: number): number {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: RGB = [255, 255, 255];
const NEAR_BLACK: RGB = [16, 14, 20];

/** Pick whichever of white or near-black is easier to read on the accent gradient. */
export function textOnAccent(a: RGB, b: RGB): RGB {
  const mid: RGB = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const lm = luminance(mid);
  return contrast(lm, luminance(WHITE)) >= contrast(lm, luminance(NEAR_BLACK)) ? WHITE : NEAR_BLACK;
}

export const THEME_STORAGE_KEY = 'tickwell.theme';

function systemPrefers(query: string): boolean {
  try {
    return window.matchMedia(query).matches;
  } catch {
    return false;
  }
}

/** Keeps a boolean in sync with a media query. */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => systemPrefers(query));
  useEffect(() => {
    let mq: MediaQueryList;
    try {
      mq = window.matchMedia(query);
    } catch {
      return undefined;
    }
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return matches;
}

export type ResolvedTheme = 'dark' | 'light';

/**
 * Writes the person's appearance settings onto <html> as attributes and CSS
 * variables. All styling then follows from CSS, with no re-render of the app.
 */
export function useApplyTheme(s: Settings): { theme: ResolvedTheme; reducedMotion: boolean } {
  const systemLight = useMedia('(prefers-color-scheme: light)');
  const systemReduced = useMedia('(prefers-reduced-motion: reduce)');
  const theme: ResolvedTheme = s.theme === 'system' ? (systemLight ? 'light' : 'dark') : s.theme;
  const reducedMotion = s.animations === 'reduced' || (s.followSystemMotion && systemReduced);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, s.theme);
    } catch {
      /* storage can be unavailable; the theme still applies for this visit */
    }
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0b0b0e' : '#f7f5f1');
  }, [theme, s.theme]);

  useEffect(() => {
    const root = document.documentElement;
    const { a, b } = resolveColor(s.customAccent ?? s.palette);
    root.style.setProperty('--accent', rgbVar(a));
    root.style.setProperty('--accent2', rgbVar(b));
    root.style.setProperty('--onaccent', rgbVar(textOnAccent(a, b)));
  }, [s.palette, s.customAccent]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-bg', s.background);
    root.style.setProperty('--bg-color', s.backgroundColor);
    if (s.backgroundImage) {
      // The value is a data: URL that was validated when it was saved.
      root.style.setProperty('--bg-image', `url("${s.backgroundImage.replace(/"/g, '%22')}")`);
    } else {
      root.style.removeProperty('--bg-image');
    }
  }, [s.background, s.backgroundColor, s.backgroundImage]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-numfont', s.numberFont);
    root.setAttribute('data-btn', s.buttonStyle);
    root.setAttribute('data-compact', String(s.compact));
    root.style.setProperty('--num-scale', String(s.numberScale));
  }, [s.numberFont, s.buttonStyle, s.compact, s.numberScale]);

  useEffect(() => {
    document.documentElement.setAttribute('data-motion', reducedMotion ? 'reduced' : 'full');
  }, [reducedMotion]);

  return { theme, reducedMotion };
}
