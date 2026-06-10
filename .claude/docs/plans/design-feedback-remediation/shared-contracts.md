# Shared contracts

[← back to PLAN.md](PLAN.md)

Canonical home for semantics referenced by ≥2 phases. Each fact lives here once; phases link in by anchor.

- [C1 — YAML byte-identity (the export contract)](#c1)
- [C2 — Persisted-blob schema version + migration](#c2)
- [C3 — Task-type catalog model + merge resolution](#c3)
- [C4 — Design-token + z-index scale + CSS-Modules conventions](#c4)

---

## C1 — YAML byte-identity (the export contract) {#c1}

**Invariant — do not weaken.** The exported YAML must remain **byte-for-byte identical** for any input a
golden fixture represents. The gate is `npx vitest run baselines`
(`src/__tests__/baselines/golden-yaml.baseline.test.js`, 4 golden fixtures in
`src/__tests__/fixtures/golden/`; note the `baselines` filter also runs performance/state/validation
baseline suites — all must pass). Round-trip (parse → re-encode) must also be byte-identical.

Implications for any phase that touches export-adjacent code (Phases 1, 4, 8, and any Phase 5/9 refactor of
`workspaceUtils.js`/`validation.js`):

- The export path is `mergeDayMetadata(animal, day)` (`src/state/workspaceUtils.js:324`) → `resolveDayConfig`
  (`:192`) → `encodeYaml` (`src/io/yaml.js`). Key order is fixed by `*_ORDER` arrays in `workspaceUtils.js`
  (`:39-57`, incl. `TASK_ORDER` at `:44`). Reordering keys, changing types (string↔number), or
  emitting/omitting a key all break C1.
- New internal structure (the task catalog, C3) must be expressed as **"what `mergeDayMetadata`
  resolves,"** never as new exported keys.
- If a baseline legitimately must change, regenerate via `node src/__tests__/fixtures/golden/generate-golden.js`,
  **review the diff**, and document why in the PR + CHANGELOG (see CLAUDE.md "Golden Baseline Tests"). Note
  `generate-golden.js` imports `io/yaml` with an explicit `.js` extension — Phase 2 updates that import.
- A behavior-preserving refactor (Phases 5, 9) must change baselines by **zero bytes**.

---

## C2 — Persisted-blob schema version + migration {#c2}

**Owner:** `src/state/persistence.js`. Current state: `WORKSPACE_STORAGE_KEY = 'rec_to_nwb_workspace_v1'`
(`:63`), `WORKSPACE_SCHEMA_VERSION = 2` (`:70`), `MIGRATABLE_SCHEMA_VERSIONS = new Set([1])` (`:71`). The
load branch (`:122-140`) accepts the current version *or* a "migratable" one, then runs
`normalizeWorkspaceDevices` — i.e. **there is no real shape-transform today**, only device normalization.
An unrecognized version is discarded with `LOAD_DISCARD_REASON.VERSION_MISMATCH`.

**Contract (introduced in [Phase 7](phase-7-persistence-migration.md), consumed by Phases 8 & 10):**

- Migrations are an **ordered registry of pure functions** `migrators[n]: (blobV_n) => blobV_{n+1}`, applied
  in sequence from the stored `schemaVersion` up to `WORKSPACE_SCHEMA_VERSION`. Each migrator is total and
  tested with a checked-in `vN` fixture.
- **Bump `WORKSPACE_SCHEMA_VERSION` only together with a registered migrator** from the previous version and
  a fixture proving `load(vN-blob)` hydrates to the current shape (no discard, no data loss).
- `MIGRATABLE_SCHEMA_VERSIONS` is **derived** from the registry's covered range (not hand-maintained).
- Migration runs **before** `ensureWorkspaceShape`/`normalizeWorkspaceDevices` so downstream code only ever
  sees the current shape.
- Non-destructive: a field a migrator can't map forward is preserved or surfaced via the existing
  `recovered`/`discarded` notice path, never silently dropped.

Phase 8 (task catalog, v2→v3) and Phase 10 (`appliedToDays`→derived, the next bump) are the first real shape
changes and **must** register a migrator under this contract.

---

## C3 — Task-type catalog model + merge resolution {#c3}

**Introduced in [Phase 8](phase-8-task-type-catalog.md); the UI shell in [Phase 6](phase-6-tasks-epochs-redesign.md) is built to consume it.**

**Mental model (per [ux-principles.md](../../research/ux-principles.md) recognition-over-recall):** a *task
type* (e.g. "sleep", "w-track") is defined **once on the animal**; each **day** *selects* the types it ran
and *orders* their epochs — it does not re-type task definitions. This mirrors the **existing**
camera pattern: `animal.cameras` (catalog) + `day.cameras_used` (per-day reference) + `resolveDayCameraUsage`
(export resolution) — reuse that structure, don't invent a new one.

**Shape (internal/persisted — never exported directly):**

- Animal gains `taskTypes: TaskType[]`, where
  `TaskType = { id, task_name, task_description, task_environment, camera_id: number[] }`.
- Day gains ordered `taskInstances: { taskTypeId, task_epochs: number[] }[]`, replacing inline `day.tasks`
  as the source of truth. (Field names are internal; confirm against `state/workspaceTypes.ts`.)

**Dedup key = `task_name`** (the Spyglass dataset-unique identity; one `TaskType` per name). This is the
*reason* for the catalog: Spyglass `common_task.py` raises on a duplicate `task_name` with a different
`task_description`, so the catalog makes that divergence structurally impossible. An **existing**
`divergent_task_identity` rule (`rulesValidation.js:~982`, via `identityDivergences`) already flags
same-`task_name`/different-`task_description` on the *exported* `tasks[]`; Phase 8 adds a **catalog-level
`task_name` uniqueness** rule on `taskTypes[]` that must **reconcile with — not duplicate or contradict —**
`divergent_task_identity`. (The per-day epoch-ownership rule `duplicateTaskEpochs`,
`rulesValidation.js:~752`, is unchanged.)

**Migration (C2) — the dedup/conflict algorithm (specify exactly; do not let an executor guess):**

- For each animal, scan its days' inline `day.tasks[]` in **date order**. For each entry, key by `task_name`:
  - **First occurrence** of a name → create the canonical `TaskType` from its `{task_description,
    task_environment, camera_id}`; the day gets a `taskInstance` referencing it with the same `task_epochs`.
  - **Later occurrence whose `{task_description, task_environment, camera_id}` MATCHES** the canonical →
    reuse the `TaskType`; add a `taskInstance` with that day's `task_epochs`. Round-trip is byte-identical.
  - **Later occurrence that CONFLICTS** (same name, different description / environment / camera_id) → still
    reference the **canonical** `TaskType` (first-occurrence wins, for determinism), and **flag that day with
    a repairable migration issue** (`task_definition_reconciled`) recording the original vs canonical values
    so the user reviews. This **intentionally normalizes a previously Spyglass-invalid state** — it is the
    only case where a migrated day's export legitimately changes, and it is surfaced, never silent.
- All golden fixtures contain consistent task definitions, so **baselines stay byte-identical** (C1); the
  conflict path is exercised only by a dedicated fixture.

**Merge resolution (the C1-preserving bridge):** `mergeDayMetadata` resolves each `taskInstance` → an inline
`tasks[]` entry `{ task_name, task_description, task_environment, camera_id, task_epochs }` (exactly
`TASK_ORDER`, `workspaceUtils.js:44`) by looking up its `TaskType`. **Build that entry with ONLY those five
keys** before it reaches `reorderKeys(t, TASK_ORDER)` (`workspaceUtils.js:~390`) — `reorderKeys` is
*lossless* (it preserves keys outside the template, as the FsGUI path relies on), so a leaked internal key
(`taskTypeId`/`id`) would be emitted and break C1. For a day whose instances reproduce its old inline tasks,
the emitted YAML is byte-identical.

**Camera reconciliation (the catalog's one new divergence risk):** `TaskType.camera_id` is animal-level, but
cameras are filtered per day via `day.cameras_used`. Rule (Phase 8): a `TaskType.camera_id` that includes a
camera **not in the referencing day's `cameras_used`** surfaces a repairable issue (`task_camera_not_used`)
— never silently emitted. The migrator sets `TaskType.camera_id` from the day's inline values, so a migrated
unmodified day stays byte-identical; a per-day camera difference for the same `task_name` is a *conflict*
(handled by the dedup conflict path above). Required fixtures: "same name / different environment", "same
name / different camera_id", and "task type lists a camera the day didn't use".

**Invariant:** every epoch still belongs to exactly one task instance on a day (the existing
`duplicateTaskEpochs` rule); the catalog changes *where task definitions live*, not per-day epoch ownership.

---

## C4 — Design-token + z-index scale + CSS-Modules conventions {#c4}

**Introduced in [Phase 3](phase-3-design-tokens-css-modules.md); every later UI phase follows it.**

- **Tokens** live in `src/index.css` `:root` (`:100-143` today). Phase 3 adds: `--color-grey-500`; a radius
  scale `--radius-sm: 4px` / `--radius-md: 8px`; a shadow scale `--shadow-sm` / `--shadow-modal`; and a
  **z-index scale** — single source of truth for stacking:

  ```css
  --z-base: 1;        /* in-flow positioned content (e.g. .primary-nav) */
  --z-banner: 5;      /* the .home-region banner: logo + shortcuts trigger (must sit above --z-base) */
  --z-sticky: 10;     /* sticky toolbars / stepper headers */
  --z-popover: 40;    /* menus, autocompletes, switchers */
  --z-overlay: 100;   /* in-page overlays */
  --z-modal: 1000;    /* modal overlays (Modal.scss, AlertModal) */
  --z-skip-link: 1100;/* skip link must beat the modal */
  ```

  These reconcile the existing ad-hoc magic numbers (1, 2, 10, 20, 40, 100, 999, 1000). The F3 fix = give
  `.home-region` `z-index: var(--z-banner)` so it beats `.primary-nav`'s `var(--z-base)`.
- **New/migrated component styles use CSS Modules** (`*.module.css`/`*.module.scss`, CRA-native), imported as
  `styles` and referenced `className={styles.foo}` — collisions become structurally impossible.
- **Shared visual primitives** (button, form-field, status chip, modal shell) get **one** canonical
  definition, replacing the per-file copies the evaluation found (`.button-primary` in 6 files; two
  different validation-error icons). Pick **one** error glyph.
- **The lean global layer** (`index.css`, layout/typography) keeps tokens + truly global rules only.
- **Enforcement:** stylelint (added Phase 3) flags raw hex where a token exists and raw z-index integers — a
  minimal viable config (enforce tokens on `z-index`, `color`, `background-color`) is acceptable initially,
  at **warn** level; Phase 9 ratchets it to error-level when the build gate is re-armed.
- **Migration is incremental:** convert a component's styles to a module only when a phase touches it; never
  rename a global class still referenced by a non-migrated file in the same commit.
