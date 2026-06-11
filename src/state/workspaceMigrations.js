/**
 * @fileoverview Versioned forward-migration registry for the persisted workspace blob.
 *
 * The persistence layer stores `{ schemaVersion, workspace }`. When the stored shape changes, a
 * blob written by an older app version must be upgraded FORWARD rather than discarded. This module
 * is the single owner of that mechanism: an ordered registry of pure migrators (`n: vN → vN+1`)
 * and {@link migrateWorkspace}, which applies them in sequence from a blob's `schemaVersion` up to
 * the current {@link WORKSPACE_SCHEMA_VERSION}.
 *
 * Contract:
 *  - Each migrator is a TOTAL pure function registered under its SOURCE version.
 *  - Bump `WORKSPACE_SCHEMA_VERSION` only TOGETHER with a registered migrator from the previous
 *    version (a unit test enforces `current === max(source) + 1`), and a checked-in `vN` blob
 *    fixture proving the upgrade is lossless.
 *  - `MIGRATABLE_SCHEMA_VERSIONS` is DERIVED from the registry, never hand-maintained.
 *  - Migrators are non-destructive: a field a migrator can't map forward is preserved (the
 *    persistence layer surfaces a recovered/discarded notice; nothing is silently dropped).
 *  - Migration runs BEFORE device-normalization / shape-ensure in the loader, so downstream code
 *    only ever sees the current shape.
 *  - A migrator that THROWS is a developer error, never a user-data problem, and is deliberately
 *    allowed to propagate — it must NOT be caught and laundered into a discard (that would mislabel
 *    a code bug as a version mismatch and throw away recoverable data). Crash loudly instead.
 *  - This module is dependency-free: it is imported by `persistence.js`, so importing persistence
 *    here would create a cycle.
 */

/**
 * Whether `value` is a plain object record (not null, not an array).
 * @param value
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * v1 → v2. v1 and v2 share the same workspace shape — the only "v1 handling" the loader ever did
 * was device normalization, which the persistence layer still applies to EVERY loaded blob after
 * migration. So this is the identity on the workspace, kept explicit so the v1 path is a real,
 * tested migrator in the registry rather than a hand-maintained special case.
 *
 * @param {object} workspace - The v1-shaped workspace.
 * @returns {object} The same workspace (v2 shape is identical).
 */
function migrateV1ToV2(workspace) {
  return workspace;
}

/**
 * Ordered forward migrators. Key `n` upgrades a `schemaVersion`-`n` workspace to `n+1`.
 * @type {Record<number, (workspace: object) => object>}
 */
const MIGRATORS = {
  1: migrateV1ToV2,
};

/**
 * Current persisted-blob schema version — every older blob migrates UP to this. Must equal
 * `max(registered source version) + 1` (enforced by a unit test), so it cannot advance without
 * a registered migrator.
 * @type {number}
 */
export const WORKSPACE_SCHEMA_VERSION = 2;

/**
 * The `schemaVersion`s a stored blob can be migrated FROM — the registry's source versions.
 * Derived from the registry, never hand-maintained.
 * @type {Set<number>}
 */
export const MIGRATABLE_SCHEMA_VERSIONS = new Set(Object.keys(MIGRATORS).map(Number));

/**
 * Apply forward migrators from a parsed blob's `schemaVersion` up to {@link WORKSPACE_SCHEMA_VERSION}.
 *
 * @param {{ schemaVersion?: number, workspace: object }} parsed - The parsed blob root.
 * @returns {{ workspace: object } | { discarded: true }} `{ workspace }` with the workspace upgraded
 *   to the current shape; `{ discarded: true }` when the version is already-unknown, too old (below
 *   the lowest migrator), too new, non-integer, or unreachable through a registry gap — the caller
 *   maps that to a VERSION_MISMATCH discard. This does NOT device-normalize or shape-fill; the
 *   caller does that AFTER, so downstream code only ever sees the current shape.
 */
export function migrateWorkspace(parsed) {
  // Defense-in-depth: this function is exported and unit-tested in isolation, so it does not trust
  // the caller's shape guard. A non-record blob or workspace cannot be migrated — discard rather
  // than throw on `null.schemaVersion` or hand back an `undefined` workspace a future caller might
  // hydrate as empty (the silent-data-loss class this framework exists to prevent). `loadWorkspace`
  // already rejects such blobs as MALFORMED before calling here, so this never alters its behavior.
  if (!isPlainObject(parsed) || !isPlainObject(parsed.workspace)) {
    return { discarded: true };
  }

  const version = parsed.schemaVersion;

  // Already current → no migrator runs (behaves exactly as the pre-registry current-version path).
  if (version === WORKSPACE_SCHEMA_VERSION) {
    return { workspace: parsed.workspace };
  }

  // Must be an integer source version the registry knows how to migrate from.
  if (!Number.isInteger(version) || !MIGRATABLE_SCHEMA_VERSIONS.has(version)) {
    return { discarded: true };
  }

  let workspace = parsed.workspace;
  for (let from = version; from < WORKSPACE_SCHEMA_VERSION; from += 1) {
    const migrate = MIGRATORS[from];
    // A gap in the chain (a source version with no migrator before reaching current) cannot be
    // bridged — discard rather than silently stop part-way at a stale shape.
    if (!migrate) return { discarded: true };
    workspace = migrate(workspace);
  }
  return { workspace };
}
