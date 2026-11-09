// Builds the two diffs shown in images/demo.gif and writes them to diffs.json.
// Run `npm run compile` first: the Tidy Tint side uses the real compiled code.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { applyChanges, detectFormatting } = require('../../out/jsonEdit.js');
const { buildColors, MANAGED_KEYS } = require('../../out/palette.js');
const { parseHex } = require('../../out/colors.js');
const { applyEdits, modify, parse } = require('jsonc-parser');

const SECTION = 'workbench.colorCustomizations';
const opts = { activityBar: false, titleBar: false, statusBar: true };

// A hand-ordered settings.json, already tinted blue, with the user's own colors and comments.
const blue = buildColors(parseHex('#2f6fd6'), opts);
const before = `{
    "editor.fontSize": 14,
    "workbench.colorCustomizations": {
        // My own tweaks, grouped on purpose
        "editor.lineHighlightBackground": "#ffffff0d",
        "editorCursor.foreground": "#ffcc00",
        // Workspace tint
        "statusBar.background": "${blue['statusBar.background']}",
        "statusBar.foreground": "${blue['statusBar.foreground']}",
        "statusBarItem.hoverBackground": "${blue['statusBarItem.hoverBackground']}",
        "terminal.background": "#1b1b1f"
    },
    "files.trimTrailingWhitespace": true
}
`;

// The user switches the workspace color to green.
const green = buildColors(parseHex('#2e8b57'), opts);

// Tidy Tint: one key at a time, through the real applyChanges.
const tidy = applyChanges(before, Object.entries(green).map(([k, v]) => ({ path: [SECTION, k], value: v })));

// Typical whole-object approach (getConfiguration().update()): read the parsed
// value (comments are gone), drop the tool's keys, append the new ones, and
// write the whole object back.
const current = parse(before)[SECTION];
const rest = Object.fromEntries(Object.entries(current).filter(([k]) => !MANAGED_KEYS.includes(k)));
const rewritten = { ...rest, ...Object.fromEntries(Object.entries(green).filter(([, v]) => v !== undefined)) };
const other = applyEdits(before, modify(before, [SECTION], rewritten, { formattingOptions: detectFormatting(before) }));

/** Line diff (LCS) as [{ op: ' ' | '-' | '+', text }]. */
function diff(a, b) {
  const x = a.replace(/\n$/, '').split('\n');
  const y = b.replace(/\n$/, '').split('\n');
  const L = Array.from({ length: x.length + 1 }, () => new Array(y.length + 1).fill(0));
  for (let i = x.length - 1; i >= 0; i--)
    for (let j = y.length - 1; j >= 0; j--)
      L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < x.length || j < y.length) {
    if (i < x.length && j < y.length && x[i] === y[j]) { out.push({ op: ' ', text: x[i] }); i++; j++; }
    else if (i < x.length && (j === y.length || L[i + 1][j] >= L[i][j + 1])) out.push({ op: '-', text: x[i++] });
    else out.push({ op: '+', text: y[j++] });
  }
  return out;
}

const count = d => ({ removed: d.filter(l => l.op === '-').length, added: d.filter(l => l.op === '+').length });
const result = {
  other: { lines: diff(before, other) },
  tidy: { lines: diff(before, tidy) },
};
for (const side of Object.values(result)) Object.assign(side, count(side.lines));

writeFileSync(join(here, 'diffs.json'), JSON.stringify(result, null, 2) + '\n');
for (const [name, side] of Object.entries(result)) {
  console.log(`--- ${name}: -${side.removed} +${side.added}`);
  for (const l of side.lines) console.log(l.op + ' ' + l.text);
}
