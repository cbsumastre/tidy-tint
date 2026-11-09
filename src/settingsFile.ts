import * as path from 'path';
import * as vscode from 'vscode';
import { JSONPath } from 'jsonc-parser';
import { applyChanges, SettingChange } from './jsonEdit';

export interface SettingsTarget { uri: vscode.Uri; prefix: JSONPath }

/**
 * Colors are window-scoped settings: in a multi-root workspace they go in the
 * .code-workspace file (under "settings"); otherwise in .vscode/settings.json.
 */
export async function resolveTarget(): Promise<SettingsTarget | undefined> {
  const wsFile = vscode.workspace.workspaceFile;
  if (wsFile && wsFile.scheme !== 'untitled') return { uri: wsFile, prefix: ['settings'] };

  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.length) {
    vscode.window.showWarningMessage('Tidy Tint: open a folder to color the workspace.');
    return undefined;
  }
  if (folders.length > 1) {
    vscode.window.showWarningMessage('Tidy Tint: save this multi-root workspace (.code-workspace) to color it.');
    return undefined;
  }
  return { uri: vscode.Uri.joinPath(folders[0].uri, '.vscode', 'settings.json'), prefix: [] };
}

async function openOrCreate(uri: vscode.Uri): Promise<vscode.TextDocument> {
  try {
    await vscode.workspace.fs.stat(uri);
  } catch {
    await vscode.workspace.fs.createDirectory(uri.with({ path: path.posix.dirname(uri.path) }));
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode('{\n}\n'));
  }
  return vscode.workspace.openTextDocument(uri);
}

/** Edits the file as text. Returns false if there was nothing to change. */
export async function editSettings(target: SettingsTarget, changes: SettingChange[], pruneIfEmpty: JSONPath[] = []): Promise<boolean> {
  const doc = await openOrCreate(target.uri);
  const original = doc.getText();
  const updated = applyChanges(
    original,
    changes.map(c => ({ path: [...target.prefix, ...c.path], value: c.value })),
    pruneIfEmpty.map(p => [...target.prefix, ...p]),
  );
  if (updated === original) return false;

  // WorkspaceEdit instead of writing to disk: respects the open buffer and supports undo.
  const edit = new vscode.WorkspaceEdit();
  edit.replace(doc.uri, new vscode.Range(doc.positionAt(0), doc.positionAt(original.length)), updated);
  if (!(await vscode.workspace.applyEdit(edit))) throw new Error('Could not edit ' + target.uri.fsPath);
  await doc.save();
  return true;
}
