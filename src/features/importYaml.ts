/**
 * @fileoverview The UI-layer parse helper for the YAML import flow: turn the raw `File[]` the
 * picker / drop-zone yields into the `{ decodedFiles, parseFailures }` shape `planImport` consumes.
 *
 * This is the ONLY place a bad file is tolerated quietly-but-visibly: a file that fails to read,
 * fails to parse as YAML, or parses to a NON-object document (a scalar or array, which can carry no
 * `subject` / `session_id`) is collected into `parseFailures` with a human reason — never thrown.
 * The preview's full un-importable list is `parseFailures` ++ `plan.unimportable`, so nothing a user
 * dropped in disappears silently.
 *
 * @module features/importYaml
 */

import { decodeYaml } from '../io/yaml';

/**
 * Read + decode a batch of dropped/selected YAML files. Pure I/O: it touches no store and never
 * throws on a bad file. Each `File` is read via `File.text()`, decoded with {@link decodeYaml}, and
 * either attributed to `decodedFiles` (a plain-object document) or `parseFailures` (read error,
 * parse error, or non-object document) with a `sourceName` + `reason`. Input order is preserved
 * within each output list.
 *
 * @param files - The files the picker / drop-zone provided (may be a FileList-like array).
 * @returns The decoded plain-object documents and the per-file parse failures.
 */
export async function parseImportFiles(
  files: File[] | FileList | null | undefined
): Promise<{
  decodedFiles: Array<{ sourceName: string; flatModel: object }>;
  parseFailures: Array<{ sourceName: string; reason: string }>;
}> {
  const list = Array.isArray(files) ? files : files ? Array.from(files) : [];
  const decodedFiles: Array<{ sourceName: string; flatModel: object }> = [];
  const parseFailures: Array<{ sourceName: string; reason: string }> = [];

  for (const file of list) {
    const sourceName = file?.name ?? '(unnamed file)';
    let text: string;
    try {
      text = await file.text();
    } catch (error) {
      parseFailures.push({
        sourceName,
        reason: `Could not read file: ${(error as Error)?.message ?? String(error)}`,
      });
      continue;
    }

    let flatModel: unknown;
    try {
      flatModel = decodeYaml(text);
    } catch (error) {
      parseFailures.push({
        sourceName,
        reason: `Not valid YAML: ${(error as Error)?.message ?? String(error)}`,
      });
      continue;
    }

    if (flatModel === null || typeof flatModel !== 'object' || Array.isArray(flatModel)) {
      parseFailures.push({
        sourceName,
        reason: 'YAML document is not a metadata object (expected a top-level mapping).',
      });
      continue;
    }

    decodedFiles.push({ sourceName, flatModel });
  }

  return { decodedFiles, parseFailures };
}
