import { RGB, isLight, darken, lighten, readableForeground, rotateHue, toHex } from './colors';

export interface AffectOptions { activityBar: boolean; titleBar: boolean; statusBar: boolean }

/** Every key Tidy Tint manages. No other key is ever touched. */
export const MANAGED_KEYS = [
  'activityBar.background',
  'activityBar.activeBackground',
  'activityBar.foreground',
  'activityBar.inactiveForeground',
  'activityBarBadge.background',
  'activityBarBadge.foreground',
  'titleBar.activeBackground',
  'titleBar.activeForeground',
  'titleBar.inactiveBackground',
  'titleBar.inactiveForeground',
  'statusBar.background',
  'statusBar.foreground',
  'statusBarItem.hoverBackground',
] as const;

/**
 * Returns a value for every managed key. `undefined` means
 * "remove this key" (the area is disabled).
 */
export function buildColors(base: RGB, opts: AffectOptions): Record<string, string | undefined> {
  const fg = readableForeground(base);
  const badge = rotateHue(base, 150);
  const hover = isLight(base) ? darken(base, 0.1) : lighten(base, 0.1);

  const activity = {
    'activityBar.background': toHex(base),
    'activityBar.activeBackground': toHex(base),
    'activityBar.foreground': toHex(fg),
    'activityBar.inactiveForeground': toHex(fg, 0.6),
    'activityBarBadge.background': toHex(badge),
    'activityBarBadge.foreground': toHex(readableForeground(badge)),
  };
  const title = {
    'titleBar.activeBackground': toHex(base),
    'titleBar.activeForeground': toHex(fg),
    'titleBar.inactiveBackground': toHex(base, 0.6),
    'titleBar.inactiveForeground': toHex(fg, 0.6),
  };
  const status = {
    'statusBar.background': toHex(base),
    'statusBar.foreground': toHex(fg),
    'statusBarItem.hoverBackground': toHex(hover),
  };

  const out: Record<string, string | undefined> = {};
  for (const k of MANAGED_KEYS) out[k] = undefined;
  if (opts.activityBar) Object.assign(out, activity);
  if (opts.titleBar) Object.assign(out, title);
  if (opts.statusBar) Object.assign(out, status);
  return out;
}
