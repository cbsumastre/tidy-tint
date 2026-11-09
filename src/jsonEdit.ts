import { applyEdits, Edit, findNodeAtLocation, format, FormattingOptions, JSONPath, modify, parseTree } from 'jsonc-parser';

export interface SettingChange { path: JSONPath; value: unknown }

/** Detects the indentation and line ending the file already uses. */
export function detectFormatting(text: string): FormattingOptions {
  const indent = /^([ \t]+)\S/m.exec(text)?.[1] ?? '    ';
  const usesTabs = indent.includes('\t');
  return {
    insertSpaces: !usesTabs,
    tabSize: usesTabs ? 4 : indent.length,
    eol: text.includes('\r\n') ? '\r\n' : '\n',
  };
}

/**
 * Applies changes key by key to JSONC text.
 * - An existing key gets its value changed in place (it never moves).
 * - A new key is appended at the end of its object.
 * - value === undefined removes the key (if present).
 * - Comments, order and formatting of the rest of the file are untouched.
 * - Any object in `pruneIfEmpty` that ends up empty is removed.
 */
export function applyChanges(original: string, changes: SettingChange[], pruneIfEmpty: JSONPath[] = []): string {
  let text = original.trim() === '' ? '{\n}\n' : original;
  const options = detectFormatting(text);

  for (const { path, value } of changes) {
    const rootIsEmpty = (parseTree(text)?.children?.length ?? 0) === 0;
    text = value === undefined
      ? removeProperty(text, path)
      : rootIsEmpty // nothing to protect: full formatting
        ? applyEdits(text, modify(text, path, value, { formattingOptions: options }))
        : applyMinimal(text, modify(text, path, value, {}), options);
  }

  for (const path of pruneIfEmpty) {
    const node = findNodeAtLocation(parseTree(text)!, path);
    if (node?.type === 'object' && (node.children?.length ?? 0) === 0) text = removeProperty(text, path);
  }
  return text;
}

/**
 * Applies edits unformatted, then formats ONLY the inserted text so that
 * jsonc-parser does not reformat neighboring lines we did not touch.
 */
function applyMinimal(text: string, edits: Edit[], options: FormattingOptions): string {
  for (const e of [...edits].sort((a, b) => b.offset - a.offset)) {
    text = text.slice(0, e.offset) + e.content + text.slice(e.offset + e.length);
    if (e.content.length > 0) {
      text = applyEdits(text, format(text, { offset: e.offset, length: e.content.length }, options));
    }
  }
  return text;
}

/** Removes a property with its comma and line, without reformatting anything else. */
function removeProperty(text: string, path: JSONPath): string {
  const valueNode = findNodeAtLocation(parseTree(text)!, path);
  const prop = valueNode?.parent;
  const obj = prop?.parent;
  if (!prop || prop.type !== 'property' || !obj?.children) return text;

  const siblings = obj.children;
  const i = siblings.indexOf(prop);
  let start: number, end: number;

  if (siblings.length === 1) {
    // Only property: the object becomes "{}".
    start = obj.offset + 1;
    end = obj.offset + obj.length - 1;
  } else if (i < siblings.length - 1) {
    // Another one follows: delete from this property to the start of the next.
    start = lineStartIfOnlyIndent(text, prop.offset);
    end = lineStartIfOnlyIndent(text, siblings[i + 1].offset);
  } else {
    // It is the last one: delete from the end of the previous one (including its comma).
    const prev = siblings[i - 1];
    start = prev.offset + prev.length;
    end = prop.offset + prop.length;
  }
  return text.slice(0, start) + text.slice(end);
}

/** If only indentation precedes `offset` on its line, returns the line start. */
function lineStartIfOnlyIndent(text: string, offset: number): number {
  let p = offset;
  while (p > 0 && (text[p - 1] === ' ' || text[p - 1] === '\t')) p--;
  return p === 0 || text[p - 1] === '\n' ? p : offset;
}
