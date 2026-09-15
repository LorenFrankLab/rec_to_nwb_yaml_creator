import { buildWorkspaceBackup } from '../state/persistence';
import { backupFilename } from '../domain/workspaceBackup';
import { downloadYamlFile } from '../io/yaml';
import type { Workspace } from '../state/workspaceTypes';

/** The app version stamped into backups (package.json is not importable in the browser bundle). */
export const APP_VERSION = '3.0.0-modern';

/** Download a text file (reuses the YAML download primitive; the MIME type is irrelevant to the browser save). */
export function downloadText(filename: string, text: string): void {
  downloadYamlFile(filename, text);
}

/**
 * Download the whole workspace as a portable backup file — including the exact bytes of every
 * download the receipts refer to. Shared by the backup panel and the read-only-tab banner (a
 * reader may always take a copy — reading is not editing).
 *
 * @param workspace - The workspace slice.
 */
export async function downloadWorkspaceBackup(workspace: Workspace): Promise<void> {
  downloadText(backupFilename(), await buildWorkspaceBackup(workspace, APP_VERSION));
}
