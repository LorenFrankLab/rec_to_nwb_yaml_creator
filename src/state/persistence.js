/**
 * @fileoverview Workspace persistence to localStorage.
 *
 * Serializes ONLY the workspace slice (animals + days + settings). Legacy formData
 * is never persisted, and nothing that is itself YAML output is ever persisted.
 *
 * Stored shape: { schemaVersion: <int>, workspace }. On a missing blob, parse error,
 * or schemaVersion mismatch, loadWorkspace returns null so the caller starts fresh.
 */

/** localStorage key for the persisted workspace blob. */
export const WORKSPACE_STORAGE_KEY = 'rec_to_nwb_workspace_v1';

/**
 * Current persisted-blob schema version. Bump when the stored shape changes in a
 * way that older blobs cannot be safely hydrated into; a mismatch is discarded.
 * @type {number}
 */
export const WORKSPACE_SCHEMA_VERSION = 1;

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
 * @returns {{ workspace: object } | { workspace: null, discarded: LOAD_DISCARD_REASON } | null}
 *   - `{ workspace }` on a successful, version-matching load.
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

  // Structural corruption (not a version problem) → MALFORMED.
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.workspace ||
    typeof parsed.workspace !== 'object'
  ) {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.MALFORMED };
  }

  // Structurally sound but from an incompatible schema version → VERSION_MISMATCH.
  if (parsed.schemaVersion !== WORKSPACE_SCHEMA_VERSION) {
    return { workspace: null, discarded: LOAD_DISCARD_REASON.VERSION_MISMATCH };
  }

  return { workspace: parsed.workspace };
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
    workspace,
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
