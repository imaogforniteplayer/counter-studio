export type RGB = [number, number, number];

export interface Swatch {
  id: string;
  name: string;
  a: RGB;
  b: RGB;
}

export const SWATCHES: Swatch[] = [
  { id: 'ember', name: 'Ember', a: [255, 138, 61], b: [255, 77, 94] },
  { id: 'sun', name: 'Sunbeam', a: [255, 205, 64], b: [255, 150, 40] },
  { id: 'moss', name: 'Moss', a: [120, 214, 120], b: [40, 170, 120] },
  { id: 'lagoon', name: 'Lagoon', a: [64, 214, 208], b: [40, 140, 230] },
  { id: 'iris', name: 'Iris', a: [130, 140, 255], b: [170, 100, 255] },
  { id: 'orchid', name: 'Orchid', a: [236, 110, 200], b: [190, 80, 240] },
  { id: 'rose', name: 'Rose', a: [255, 110, 140], b: [235, 60, 100] },
  { id: 'slate', name: 'Graphite', a: [200, 205, 215], b: [140, 150, 170] },
];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(s: unknown): s is string {
  return typeof s === 'string' && HEX.test(s);
}

export function hexToRgb(hex: string): RGB | null {
  if (!isHex(hex)) return null;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

export function rgbToHex([r, g, b]: RGB): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

function shade([r, g, b]: RGB, amount: number): RGB {
  const f = (n: number) => (amount < 0 ? n * (1 + amount) : n + (255 - n) * amount);
  return [f(r), f(g), f(b)].map((n) => Math.max(0, Math.min(255, Math.round(n)))) as RGB;
}

export function findSwatch(id: string): Swatch | undefined {
  return SWATCHES.find((s) => s.id === id);
}

/** Resolve a swatch id or hex colour to a gradient pair. Falls back to Ember. */
export function resolveColor(color: string): { a: RGB; b: RGB } {
  const sw = findSwatch(color);
  if (sw) return { a: sw.a, b: sw.b };
  const rgb = hexToRgb(color);
  if (rgb) return { a: rgb, b: shade(rgb, -0.22) };
  const fallback = SWATCHES[0];
  return { a: fallback.a, b: fallback.b };
}

export function isValidColor(color: unknown): color is string {
  return typeof color === 'string' && (isHex(color) || !!findSwatch(color));
}

export function rgbVar([r, g, b]: RGB): string {
  return `${r} ${g} ${b}`;
}

export function cssRgb([r, g, b]: RGB, alpha = 1): string {
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${alpha})`;
}

/** Choose a readable text colour for content drawn on top of the given colour. */
export function onAccent([r, g, b]: RGB): RGB {
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return lum > 0.58 ? [16, 14, 20] : [255, 255, 255];
}

export function gradientCss(color: string, angle = 135): string {
  const { a, b } = resolveColor(color);
  return `linear-gradient(${angle}deg, ${cssRgb(a)}, ${cssRgb(b)})`;
}
