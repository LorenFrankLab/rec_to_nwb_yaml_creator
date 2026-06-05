/**
 * @fileoverview Workspace persistence to localStorage.
 *
 * Serializes ONLY the workspace slice (animals + days + settings). Legacy formData
 * is never persisted, and nothing that is itself YAML output is ever persisted.
 *
 * Stored shape: { schemaVersion: <int>, workspace }. `loadWorkspace` returns bare
 * `null` only for a missing blob / unavailable storage; an unusable blob (parse error,
 * version mismatch, malformed shape) returns `{ workspace: null, discarded }`, and a
 * structurally-incomplete-but-valid blob returns `{ workspace, recovered }`. See the
 * `loadWorkspace` JSDoc for the full return contract.
 */

import { normalizeWorkspaceDevices } from '../utils/deviceNormalization';
import { createDefaultWorkspace } from './workspaceUtils';

/** Top-level sections every consumer reads directly (and would crash on if missing). */
const REQUIRED_WORKSPACE_KEYS = ['animals', 'days', 'settings'];

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Shape-checks a hydrated workspace's required top-level sections (`animals`, `days`,
 * `settings`), distinguishing two cases that must be handled differently:
 *
 * - **Absent** (`undefined`/`null`, i.e. a structurally empty/partial blob such as
 *   `{schemaVersion, workspace:{}}` from an older/aborted write): restore from the
 *   canonical default shape so the blob hydrates cleanly instead of leaving a consumer
 *   to hit `Object.keys(undefined)`. Reported via `missingKeys` for a recovery notice.
 * - **Present but wrong-typed** (e.g. `animals` is an array/string): genuine
 *   corruption, NOT absence. It is reported via `corruptKeys` and is NOT silently
 *   overwritten here — the caller discards the blob loudly rather than destroying real
 *   data while telling the user it was merely "missing".
 *
 * Existing valid sections are preserved untouched.
 *
 * @param {object} workspace - The (device-normalized) workspace to shape-check.
 * @returns {{ workspace: object, missingKeys: string[], corruptKeys: string[] }}
 *   The (absent-filled) workspace, the restored-from-absent sections, and the
 *   present-but-corrupt sections.
 */
function ensureWorkspaceShape(workspace) {
  const defaults = createDefaultWorkspace();
  const result = { ...workspace };
  const missingKeys = [];
  const corruptKeys = [];

  REQUIRED_WORKSPACE_KEYS.forEach((key) => {
    const value = workspace[key];
    if (value === undefined || value === null) {
      missingKeys.push(key);
      result[key] = defaults[key];
    } else if (!isPlainObject(value)) {
      corruptKeys.push(key);
    }
  });

  return { workspace: result, missingKeys, corruptKeys };
}

/** localStorage key for the persisted workspace blob. */
export const WORKSPACE_STORAGE_KEY = 'rec_to_nwb_workspace_v1';

/**
 * Current persisted-blob schema version. Bump when the stored shape changes in a
 * way that older blobs cannot be safely hydrated into; a mismatch is discarded.
 * @type {number}
 */
export const WORKSPACE_SCHEMA_VERSION = 2;
const MIGRATABLE_SCHEMA_VERSIONS = new Set([1]);

/**
 * Reason codes returned alongside a discarded load, for a user-visible notice.
 * @readonly
 * @enum {string}
 */
export const LOAD_DISCARD_REASON = {
  PARSE_ERROR: 'parse-error',
  VERSION_MISMATCH: 'version-mismatch',
  MALFORMED: 'malformed',
};

/**
 * Loads the persisted workspace.
 *
 * @returns {{ workspace: object, recovered?: { missingKeys: string[] } } | { workspace: null, discarded: LOAD_DISCARD_REASON } | null}
 *   - `{ workspace }` on a successful, version-matching load.
 *   - `{ workspace, recovered: { missingKeys } }` when the blob was structurally
 *     valid but missing required top-level sections; they were restored to the default
 *     shape and `missingKeys` names them — caller shows a recovery notice.
 *   - `{ workspace: null, discarded: <reason> }` when a blob exists but is unusable
 *     (corrupt JSON, malformed shape, or wrong schemaVersion) — caller discards and
 *     shows a notice. `discarded` is a `LOAD_DISCARD_REASON` member.
 *   - `null` when no blob exists, or storage is unavailable (clean first run; no notice).
 */
export function loadWorkspace() {
  let raw;
  try {
    raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // Storage unavailable (e.g. private mode / disabled). Treat as clean first run.
    return null;
  }

  if (raw == null) return null;

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.PARSE_ERROR };
  }

  // Structural corruption (not a version problem) → MALFORMED. The workspace root must
  // be a plain object: an array (or other non-plain-object) is root corruption, not an
  // empty/partial object, and must not be laundered into a default-shaped workspace.
  if (!isPlainObject(parsed) || !isPlainObject(parsed.workspace)) {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.MALFORMED };
  }

  if (
    parsed.schemaVersion === WORKSPACE_SCHEMA_VERSION ||
    MIGRATABLE_SCHEMA_VERSIONS.has(parsed.schemaVersion)
  ) {
    // Device-normalize first, then guarantee the required top-level sections exist so a
    // valid-but-empty/partial blob hydrates cleanly. A restored section is reported via
    // `recovered` for a user-facing notice (never silently filled).
    const { workspace, missingKeys, corruptKeys } = ensureWorkspaceShape(
      normalizeWorkspaceDevices(parsed.workspace)
    );
    // A present-but-wrong-typed required section is corruption, not absence: discard
    // loudly rather than silently overwrite real data and mislabel it as "restored".
    if (corruptKeys.length > 0) {
      return { workspace: null, discarded: LOAD_DISCARD_REASON.MALFORMED };
    }
    return missingKeys.length > 0
      ? { workspace, recovered: { missingKeys } }
      : { workspace };
  }

  // Structurally sound but from an incompatible schema version → VERSION_MISMATCH.
  return { workspace: null, discarded: LOAD_DISCARD_REASON.VERSION_MISMATCH };
}

/**
 * Persists the workspace slice. Throws on failure (e.g. quota exceeded) so the
 * caller can surface an error and avoid claiming a successful save.
 *
 * @param {object} workspace - The workspace slice (animals + days + settings).
 * @returns {void}
 */
export function saveWorkspace(workspace) {
  const blob = JSON.stringify({
    schemaVersion: WORKSPACE_SCHEMA_VERSION,
    workspace: normalizeWorkspaceDevices(workspace),
  });
  window.localStorage.setItem(WORKSPACE_STORAGE_KEY, blob);
}

/**
 * Removes the persisted blob. Used when discarding an unusable load.
 * @returns {void}
 */
export function clearWorkspace() {
  try {
    window.localStorage.removeItem(WORKSPACE_STORAGE_KEY);
  } catch {
    // No-op: nothing else to do if storage is unavailable.
  }
}
