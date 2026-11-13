import { clampNumber } from './shared';

/** Width available to page content, allowing for the side navigation and page padding. */
export function contentWidth(viewportWidth: number): number {
  const nav = viewportWidth >= 1024 ? 248 : viewportWidth >= 768 ? 76 : 0;
  const pad = viewportWidth >= 1024 ? 80 : viewportWidth >= 640 ? 48 : 32;
  return Math.min(1152, viewportWidth - nav) - pad;
}

/**
 * Font size in pixels that makes `chars` digits fit in `available` pixels, never
 * larger than `max`. Digits are about 0.62em wide, and the person's own number-size
 * setting is applied on top by CSS, so it is divided out here.
 */
export function fitNumberPx(chars: number, available: number, max: number, scale: number): number {
  const fit = available / (Math.max(chars, 1) * 0.62 * Math.max(scale, 0.1));
  return Math.round(clampNumber(fit, 28, max));
}
