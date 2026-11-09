import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { applyChanges } from '../jsonEdit';
import { buildColors, MANAGED_KEYS } from '../palette';
import { parseHex } from '../colors';

const CC = 'workbench.colorCustomizations';
const ALL = { activityBar: true, titleBar: true, statusBar: true };

const sample = `{
  // my settings
  "editor.fontSize": 14,
  "workbench.colorCustomizations": {
    "statusBar.background": "#000000", // set by hand
    "editorCursor.foreground": "#ff0000",
    "titleBar.activeBackground": "#111111"
  },
  "files.exclude": { "out": true }
}
`;

function setColor(text: string, hex: string, opts = ALL): string {
  const colors = buildColors(parseHex(hex)!, opts);
  return applyChanges(text, [
    ...Object.entries(colors).map(([k, v]) => ({ path: [CC, k], value: v })),
    { path: ['tidyTint.color'], value: hex },
  ], [[CC]]);
}

const keyOrder = (t: string) => [...t.matchAll(/"([\w.]+)":/g)].map(m => m[1]);

test('existing keys keep their position across color changes', () => {
  const first = setColor(sample, '#2f6fd6');
  const second = setColor(first, '#d63c3c');
  assert.deepEqual(keyOrder(second), keyOrder(first));
  assert.ok(first.indexOf('"statusBar.background"') < first.indexOf('"editorCursor.foreground"'));
});

test('comments and untouched lines are preserved', () => {
  const out = setColor(sample, '#2f6fd6');
  assert.ok(out.includes('// my settings'));
  assert.ok(out.includes('// set by hand'));
  assert.ok(out.includes('"files.exclude": { "out": true }'));
});

test('removing colors deletes only managed keys', () => {
  const colored = setColor(sample, '#2f6fd6');
  const removed = applyChanges(colored, [
    ...MANAGED_KEYS.map(k => ({ path: [CC, k], value: undefined })),
    { path: ['tidyTint.color'], value: undefined },
  ], [[CC]]);
  assert.ok(removed.includes('"editorCursor.foreground": "#ff0000"'));
  assert.ok(!removed.includes('statusBar.background'));
  assert.ok(!removed.includes('tidyTint.color'));
});

test('an emptied colorCustomizations object is removed', () => {
  const text = '{\n  "x": 1,\n  "workbench.colorCustomizations": {\n    "a": "#fff"\n  }\n}\n';
  const out = applyChanges(text, [{ path: [CC, 'a'], value: undefined }], [[CC]]);
  assert.equal(out, '{\n  "x": 1\n}\n');
});

test('works on an empty file', () => {
  const out = applyChanges('', [{ path: [CC, 'a'], value: '#fff' }]);
  assert.deepEqual(JSON.parse(out), { [CC]: { a: '#fff' } });
});

test('respects tab indentation', () => {
  const out = applyChanges('{\n\t"x": 1\n}\n', [{ path: [CC, 'a'], value: '#fff' }]);
  assert.ok(out.includes('\n\t"workbench.colorCustomizations": {\n\t\t"a": "#fff"\n\t}'));
});

test('writes under "settings" in a .code-workspace file', () => {
  const out = applyChanges('{\n  "folders": [{ "path": "." }]\n}\n', [{ path: ['settings', CC, 'a'], value: '#fff' }]);
  assert.deepEqual(JSON.parse(out).settings, { [CC]: { a: '#fff' } });
});

test('parseHex accepts short and long forms and rejects garbage', () => {
  assert.deepEqual(parseHex('#fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseHex('2f6fd6'), { r: 47, g: 111, b: 214 });
  assert.equal(parseHex('#12345'), undefined);
  assert.equal(parseHex('blue'), undefined);
});
