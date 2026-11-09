export interface RGB { r: number; g: number; b: number }

export function parseHex(input: string): RGB | undefined {
  let s = input.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(s)) s = s.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(s)) return undefined;
  const n = parseInt(s, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function toHex({ r, g, b }: RGB, alpha?: number): string {
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b) + (alpha !== undefined ? h(alpha * 255) : '');
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export const lighten = (c: RGB, t: number) => mix(c, { r: 255, g: 255, b: 255 }, t);
export const darken = (c: RGB, t: number) => mix(c, { r: 0, g: 0, b: 0 }, t);

/** Relative luminance (WCAG): 0 = black, 1 = white. */
export function luminance({ r, g, b }: RGB): number {
  const lin = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export const isLight = (c: RGB) => luminance(c) > 0.4;

export function readableForeground(bg: RGB): RGB {
  return isLight(bg) ? { r: 21, g: 32, b: 43 } : { r: 231, g: 231, b: 231 };
}

function rgbToHsl({ r, g, b }: RGB): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => 255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1)));
  return { r: f(0), g: f(8), b: f(4) };
}

export function rotateHue(c: RGB, degrees: number): RGB {
  const [h, s, l] = rgbToHsl(c);
  return hslToRgb((h + degrees + 360) % 360, s, l);
}

export function randomColor(): RGB {
  return hslToRgb(Math.random() * 360, 0.55 + Math.random() * 0.25, 0.35 + Math.random() * 0.15);
}
