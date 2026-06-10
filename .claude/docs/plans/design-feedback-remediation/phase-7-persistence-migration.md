# Phase 7 — Persisted-blob forward-migration framework (Post-v3 #6)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The persistence layer currently *discards* a blob whose `schemaVersion` it doesn't recognize, and its only
"migration" is device normalization. Before any real persisted-shape change (the Phase 8 catalog; the
Phase 10 `appliedToDays` derivation), build a versioned forward-migration framework so old blobs upgrade
losslessly instead of being thrown away. This phase is **release-gating** for Phases 8 and 10.

**Inputs to read first:**

- [src/state/persistence.js:62-71](../../../src/state/persistence.js) — `WORKSPACE_STORAGE_KEY`, `WORKSPACE_SCHEMA_VERSION = 2`, `MIGRATABLE_SCHEMA_VERSIONS = new Set([1])`.
- [src/state/persistence.js:97-144](../../../src/state/persistence.js) — `loadWorkspace`: parse → version-check → `normalizeWorkspaceDevices` → `ensureWorkspaceShape`, and the `recovered`/`discarded` contract (`LOAD_DISCARD_REASON`).
- [src/state/persistence.js:153-159](../../../src/state/persistence.js) — `saveWorkspace`.
- `src/utils/deviceNormalization.js` `normalizeWorkspaceDevices`; `src/state/workspaceUtils.js` `createDefaultWorkspace`.

**Contracts referenced:**

- [C2 — Persisted-blob schema version + migration](shared-contracts.md#c2) — **this phase introduces the registry**; Phases 8 & 10 consume it.

## Tasks

- Create a **migrator registry** (e.g. `src/state/workspaceMigrations.js`): an ordered map of pure functions `migrators[n]: (workspaceAtVersionN) => workspaceAtVersionN+1`, plus `migrateWorkspace(parsedBlob) => { workspace } | { discarded }` applying migrators from the blob's `schemaVersion` up to `WORKSPACE_SCHEMA_VERSION`. A version below the lowest registered migrator → discard (`VERSION_MISMATCH`).
- Encode **today's v1→v2 behavior** as the first registered migrator so current behavior is preserved exactly (the existing "v1 is migratable" path only ran `normalizeWorkspaceDevices`). Verify the result equals today's hydration of a v1 blob byte-for-byte.
- **Derive** `MIGRATABLE_SCHEMA_VERSIONS` from the registry's covered range instead of the hand-maintained `new Set([1])`.
- Wire `migrateWorkspace` into `loadWorkspace` **before** `ensureWorkspaceShape`/`normalizeWorkspaceDevices`; preserve the existing `recovered`/`discarded`/`null` semantics; the no-migration (current-version) path must behave exactly as today.
- Migrations must be **non-destructive**: a field a migrator can't map forward is preserved or surfaced via the existing notice path.
- Documentation: mark Post-v3 #6 **resolved** in `docs/POST_V3_FOLLOWUPS.md`; add the rule to `CLAUDE.md` ("bump `WORKSPACE_SCHEMA_VERSION` only with a registered migrator + a `vN` fixture test"); CHANGELOG entry.

## Deliberately not in this phase

- The **v2→v3 migrator** (ships with the catalog shape change in [Phase 8](phase-8-task-type-catalog.md)) or the next bump (Phase 10) — no shape to migrate to yet.
- Any new persisted field or version bump — this phase builds the mechanism only (so it stays merge-neutral and independently shippable).

## Validation slice

| Test | Asserts |
| --- | --- |
| unit: `migrateWorkspace` v1 blob | upgrades to current shape, hydrates identically to today's `loadWorkspace(v1)` (no discard, no data loss). |
| unit: current-version blob | passes through unchanged (no migrator runs). |
| unit: below-lowest-version blob | discards with `LOAD_DISCARD_REASON.VERSION_MISMATCH`. |
| unit: `MIGRATABLE_SCHEMA_VERSIONS` | equals the registry's covered range (derived). |
| existing `persistence` tests | still pass (load/discard/recover/quota semantics unchanged). |
| `npx vitest run` (full) | green; `npx vitest run baselines` unaffected (persistence is not the export path). |

## Fixtures

Checked-in JSON blob fixtures: a `v1` blob (real-ish animals+days) and a current-`v2` blob, under a
persistence fixtures dir. These become the regression guard for every future migrator.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Registry is pure ordered functions; `migrateWorkspace` runs before shape-ensure/normalize; `MIGRATABLE_SCHEMA_VERSIONS` is derived.
- The v1→v2 migrator reproduces today's v1 hydration exactly (fixture); current-version blobs untouched.
- No shape change / no version bump in this phase.
- `docs/POST_V3_FOLLOWUPS.md` #6 marked resolved; CLAUDE.md rule + CHANGELOG added; names don't reference this plan.
