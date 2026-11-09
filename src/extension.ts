import * as vscode from 'vscode';
import { parseHex, randomColor, RGB, toHex } from './colors';
import { AffectOptions, buildColors, MANAGED_KEYS } from './palette';
import { editSettings, resolveTarget } from './settingsFile';

const CC = 'workbench.colorCustomizations';

function readOptions(): AffectOptions {
  const cfg = vscode.workspace.getConfiguration('tidyTint');
  return {
    activityBar: cfg.get('affectActivityBar', true),
    titleBar: cfg.get('affectTitleBar', true),
    statusBar: cfg.get('affectStatusBar', true),
  };
}

async function applyColor(color: RGB): Promise<void> {
  const target = await resolveTarget();
  if (!target) return;
  const colors = buildColors(color, readOptions());
  await editSettings(
    target,
    [
      ...Object.entries(colors).map(([key, value]) => ({ path: [CC, key], value })),
      { path: ['tidyTint.color'], value: toHex(color) },
    ],
    [[CC]],
  );
}

async function removeColors(): Promise<void> {
  const target = await resolveTarget();
  if (!target) return;
  await editSettings(
    target,
    [...MANAGED_KEYS.map(key => ({ path: [CC, key], value: undefined })), { path: ['tidyTint.color'], value: undefined }],
    [[CC]],
  );
}

async function changeColor(): Promise<void> {
  type Item = vscode.QuickPickItem & { color?: string; action?: 'custom' | 'random' };
  const favorites = vscode.workspace.getConfiguration('tidyTint').get<{ name: string; value: string }[]>('favoriteColors', []);
  const current = vscode.workspace.getConfiguration('tidyTint').get<string>('color');

  const items: Item[] = [
    { label: '$(edit) Enter a color…', action: 'custom' },
    { label: '$(sync) Random', action: 'random' },
    { label: 'Favorites', kind: vscode.QuickPickItemKind.Separator },
    ...favorites.map(f => ({ label: f.name, description: f.value, color: f.value })),
  ];
  const pick = await vscode.window.showQuickPick(items, { placeHolder: 'Pick a color for this workspace' });
  if (!pick) return;

  let color: RGB | undefined;
  if (pick.action === 'random') {
    color = randomColor();
  } else if (pick.action === 'custom') {
    const input = await vscode.window.showInputBox({
      prompt: 'Hex color',
      value: current ?? '#',
      validateInput: v => (parseHex(v) ? undefined : 'Use a format like #3a7bd5 or #3ad'),
    });
    color = input ? parseHex(input) : undefined;
  } else if (pick.color) {
    color = parseHex(pick.color);
  }
  if (color) await applyColor(color);
}

function safe(fn: () => Promise<void>) {
  return async () => {
    try { await fn(); } catch (err) {
      vscode.window.showErrorMessage('Tidy Tint: ' + (err instanceof Error ? err.message : String(err)));
    }
  };
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('tidyTint.changeColor', safe(changeColor)),
    vscode.commands.registerCommand('tidyTint.randomColor', safe(() => applyColor(randomColor()))),
    vscode.commands.registerCommand('tidyTint.removeColors', safe(removeColors)),
    // When the colored areas change, reapply the current color.
    vscode.workspace.onDidChangeConfiguration(e => {
      const affected = ['tidyTint.affectActivityBar', 'tidyTint.affectTitleBar', 'tidyTint.affectStatusBar'].some(k => e.affectsConfiguration(k));
      const current = parseHex(vscode.workspace.getConfiguration('tidyTint').get<string>('color') ?? '');
      if (affected && current) safe(() => applyColor(current))();
    }),
  );
}

export function deactivate(): void {}
