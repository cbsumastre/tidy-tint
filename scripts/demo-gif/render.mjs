// Renders images/demo.gif from diffs.json (see build-diffs.mjs).
// Needs ImageMagick 7 (`magick`) on PATH.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', '..', 'images', 'demo.gif');
const { other, tidy } = JSON.parse(readFileSync(join(here, 'diffs.json'), 'utf8'));

const W = 880, LINE = 24, TOP = 92, PAD = 20, FONT = 15;
const C = {
  bg: '#1e1e1e', panel: '#252526', text: '#d4d4d4', dim: '#858585', comment: '#6a9955',
  key: '#9cdcfe', str: '#ce9178', num: '#b5cea8',
  delBg: '#4b1818', delMark: '#f14c4c', addBg: '#1b4721', addMark: '#3fb950',
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CHAR = FONT * 0.602; // DejaVu Sans Mono advance width

/** Tiny JSONC tokenizer: [{ text, color }] for comments, keys, strings, literals. */
function tokens(text) {
  if (/^\s*\/\//.test(text)) return [{ text, color: C.comment }];
  const out = [];
  text.replace(/("(?:[^"\\]|\\.)*")(\s*:)?|\b(\d+|true|false)\b|([^"\d]+)/g, (m, str, colon, lit) => {
    if (str) { out.push({ text: str, color: colon ? C.key : C.str }); if (colon) out.push({ text: colon, color: C.text }); }
    else out.push({ text: m, color: lit ? C.num : C.text });
    return m;
  });
  return out;
}

/** One <text> per token at its column: no reliance on tspan flow or whitespace handling. */
function code(text, x, y) {
  let col = 0;
  return tokens(text).map(t => {
    const lead = t.text.length - t.text.trimStart().length;
    const body = t.text.trim();
    // ImageMagick's SVG renderer strips quotes at both ends; zero-width spaces
    // (rendered one cell wide) protect them, so shift left by one cell.
    const quoted = body.startsWith('"');
    const cx = x + (col + lead - (quoted ? 1 : 0)) * CHAR;
    const svg = body ? `<text x="${cx.toFixed(1)}" y="${y}" fill="${t.color}">${quoted ? '&#8203;' + esc(body) + '&#8203;' : esc(body)}</text>` : '';
    col += t.text.length;
    return svg;
  }).join('');
}

const H = TOP + Math.max(other.lines.length, tidy.lines.length) * LINE + 96;

function frame({ title, subtitle, lines, caption, captionColor, statusBar }) {
  const rows = lines.map((l, i) => {
    const y = TOP + i * LINE;
    const bg = l.op === '-' ? C.delBg : l.op === '+' ? C.addBg : null;
    const mark = l.op === '-' ? C.delMark : l.op === '+' ? C.addMark : C.dim;
    return (bg ? `<rect x="0" y="${y}" width="${W}" height="${LINE}" fill="${bg}"/>` : '') +
      `<text x="${PAD}" y="${y + 17}" fill="${mark}">${l.op === ' ' ? '' : l.op}</text>` +
      code(l.text, PAD + 22, y + 17);
  }).join('\n');
  const capY = TOP + lines.length * LINE + 38;
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" font-family="DejaVu Sans Mono" font-size="${FONT}">
<rect width="${W}" height="${H}" fill="${C.bg}"/>
<rect width="${W}" height="${TOP - 12}" fill="${C.panel}"/>
<text x="${PAD}" y="34" fill="#ffffff" font-family="DejaVu Sans" font-size="20" font-weight="bold">${esc(title)}</text>
<text x="${PAD}" y="62" fill="${C.dim}" font-family="DejaVu Sans" font-size="14">${esc(subtitle)}</text>
${rows}
<text x="${PAD}" y="${capY}" fill="${captionColor}" font-family="DejaVu Sans" font-size="17" font-weight="bold">${esc(caption)}</text>
<rect x="0" y="${H - 26}" width="${W}" height="26" fill="${statusBar}"/>
<text x="${PAD}" y="${H - 8}" fill="#e7e7e7" font-family="DejaVu Sans" font-size="13">.vscode/settings.json</text>
</svg>` };
}

const plain = tidy.lines.filter(l => l.op !== '+').map(l => ({ op: ' ', text: l.text }));
const n = s => `−${s.removed} +${s.added}`;
const frames = [
  { delay: 250, ...frame({
    title: 'Your settings.json', subtitle: 'Hand-ordered, with comments. Now change the workspace color…',
    lines: plain, caption: 'Switching the tint from blue to green…', captionColor: C.text, statusBar: '#2f6fd6' }) },
  { delay: 450, ...frame({
    title: `Typical extension  (${n(other)})`, subtitle: 'Rewrites the whole workbench.colorCustomizations object',
    lines: other.lines, caption: '✗ Comments deleted, keys moved around', captionColor: C.delMark, statusBar: '#2e8b57' }) },
  { delay: 450, ...frame({
    title: `Tidy Tint  (${n(tidy)})`, subtitle: 'Edits the file as text, one key at a time',
    lines: tidy.lines, caption: '✓ Only the changed values. Order and comments kept.', captionColor: C.addMark, statusBar: '#2e8b57' }) },
];

const dir = mkdtempSync(join(tmpdir(), 'tidy-tint-gif-'));
try {
  const args = [];
  frames.forEach((f, i) => {
    const svg = join(dir, `${i}.svg`);
    writeFileSync(svg, f.svg);
    args.push('-delay', String(f.delay), svg);
  });
  execFileSync('magick', [...args, '-loop', '0', '-layers', 'Optimize', out], { stdio: 'inherit' });
  console.log('Wrote ' + out);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
