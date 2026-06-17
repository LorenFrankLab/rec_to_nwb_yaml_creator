# Phase 7 — Test & CI hardening

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Close the safety-net + CI gaps the review surfaced. Mostly new tests/guards + one CI workflow fix.
No production behavior change (except making CI fail where it should).

**Inputs to read first:**

- [.github/workflows/test.yml:180-192](../../../../.github/workflows/test.yml) — schema-sync step that `exit 0`s when the Python schema is absent; [docs/CI_CD_PIPELINE.md:107](../../../../docs/CI_CD_PIPELINE.md) — the documented failure condition it contradicts.
- [src/validation/schemaValidation.ts:19](../../../../src/validation/schemaValidation.ts) — `addFormats(ajv)` (effectively dead — `src/nwb_schema.json` uses zero `format` keywords); the AJV-Draft-7 instance whose semantics diverge from the downstream jsonschema-Draft-2020-12 (`CLAUDE.md` "Schema Validation Differences").
- [src/state/workspaceMigrations.test.js:27,36,98](../../../../src/state/__tests__/workspaceMigrations.test.js) — version⇔migrator coupling + the v1/v2/v3 fixture load; the "bump ⇒ fixture exists" half is unenforced.
- [src/state/__tests__/fixtures/persistence/](../../../../src/state/__tests__/fixtures/persistence/) — the checked-in `vN-workspace.json` blobs.
- [src/validation/rules/electrodeGroupRules.ts:60-101](../../../../src/validation/rules/electrodeGroupRules.ts) — `missingChannelMapRows` (zero-rows-for-one-group branch, `channel_row_count_mismatch` at `electrode_groups[gi]`); the existing `channel_row_count_mismatch` tests exercise only the excess-row branch.
- [e2e/baselines/import-export.spec.js:78-256](../../../../e2e/baselines/import-export.spec.js) — ~23 assertions wrapped in `if (...isVisible())` / `if (existsSync)` self-skips.
- [src/state/__tests__/workspaceSelectors.guard.test.js:80](../../../../src/state/__tests__/workspaceSelectors.guard.test.js) — exempts the whole `validation/` dir; [src/viewModels/commands/__tests__/commandCatalog.ratchet.test.ts:21-25](../../../../src/viewModels/commands/__tests__/commandCatalog.ratchet.test.ts) — scans `viewModels/*.ts` non-recursively.

## Tasks

- **CI schema-sync fail-loud.** In `test.yml`, when the Python schema path is missing, **fail with an
  actionable message** per `CI_CD_PIPELINE.md:107` instead of `exit 0`. The workflow already checks out
  `LorenFrankLab/trodes_to_nwb` immediately before the comparison, so an absent
  `trodes_to_nwb/src/trodes_to_nwb/nwb_schema.json` is a broken gate, not an expected cross-repo skip.
  Keep the docs aligned with this fail-loud behavior.
- **Schema-draft-divergence guard (test).** Add a committed test asserting `src/nwb_schema.json` uses
  no AJV-Draft-7-vs-2020-12-divergent keywords (e.g. no `format` outside an allowlist, no `$ref`
  resolution that differs across drafts) — so a future schema edit that would validate clean here but
  behave differently in `trodes_to_nwb` fails CI. Also delete or justify the dead `addFormats(ajv)`
  (it's misleading given zero `format` usage). Scope: a structural assertion over the schema JSON, not
  a full dual-validator harness (that's a larger effort — note it as a future option).
- **Schema-version-fixture guard (test).** Add a test that `readdirSync`s
  `src/state/__tests__/fixtures/persistence/` and asserts a `vN` blob exists and loads through
  `loadWorkspace` with no discard/data-loss for **every** version in
  `MIGRATABLE_SCHEMA_VERSIONS ∪ {WORKSPACE_SCHEMA_VERSION}` — so a future version bump without a
  fixture fails CI (enforcing the CLAUDE.md rule structurally).
- **`missingChannelMapRows` behavioral test.** Add a test for the zero-rows-for-one-group branch
  (`electrodeGroupRules.ts:60-101`): a configured day with rows for some groups but zero for one →
  `channel_row_count_mismatch` at `electrode_groups[gi]`. (An electrode group exported with no channel
  map is exactly the silent downstream loss to guard.)
- **Strengthen `enum`/`uniqueItems`/`minimum` assertions.** In `src/validation/__tests__`, add
  code-specific negative assertions (not just `path.startsWith('subject')`) so a regression dropping
  `enum`/`uniqueItems`/`minimum` enforcement fails the validation suite.
- **De-fang the self-skipping e2e baseline spec.** In `e2e/baselines/import-export.spec.js`, replace
  the `if (...isVisible())` guards around the load-bearing assertions with real waits/expects so a
  selector regression FAILS instead of silently skipping. (These specs target the legacy form; keep
  that scope, just make the assertions real.) Note: if this surfaces genuine legacy-form breakage,
  that's a finding, not a reason to re-add the skips.
- **Guard fragility (test infra).** Narrow `workspaceSelectors.guard.test.js`'s `validation/`
  exemption to the actual detector modules (so a raw-shape read in `validation/HintDisplay.jsx` isn't
  silently allowed); make `commandCatalog.ratchet.test.ts` scan `viewModels/**` recursively + add a
  non-empty self-check (so a command-emitting builder in a subdir can't escape).
- **(Low) clarifying comment** on `golden-yaml.baseline.test.js` that it exercises the *encoder* only,
  pointing to `exportParity`/`legacyParity` for the real build-path byte guarantee.
- **Docs.** Update `CHANGELOG` ("Changed — CI/tests") and reconcile `CI_CD_PIPELINE.md` with whichever
  schema-sync behavior is chosen.

## Deliberately not in this phase

- A full dual-validator (AJV vs Python jsonschema) cross-check harness — the structural guard is the
  cheap protection; the full harness is a future option noted in the guard test.
- Production behavior changes (other than CI failing where it should).

## Validation slice

| Test | Asserts |
| --- | --- |
| schema-draft-divergence guard (new) | `nwb_schema.json` uses no divergent keyword; fails if one is introduced |
| persistence-fixture guard (new) | every migratable + current schema version has a `vN` fixture that `loadWorkspace`s with no discard; fails on a bump without a fixture |
| `electrodeGroupRules` test (new) | the zero-rows-for-one-group branch emits `channel_row_count_mismatch` at the right path |
| validation enum/uniqueItems/minimum (extend) | code-specific negative assertions hold |
| `e2e/baselines/import-export.spec.js` | assertions are unconditional (no `isVisible()` self-skip); a selector regression fails |
| guard tests (extend) | `workspaceSelectors` exemption narrowed; `commandCatalog.ratchet` scans recursively + has a non-empty self-check |
| `npm run check:schema` / CI dry-run | the schema-sync step's behavior matches `CI_CD_PIPELINE.md`; a missing downstream schema path exits non-zero with an actionable message |

## Fixtures

Reuse the checked-in `vN-workspace.json` persistence fixtures + the golden fixtures. The
`missingChannelMapRows` case synthesizes a configured day with a partial channel map. No new real-data
fixtures.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- Each new guard FAILS on its target violation (non-vacuous — prove it by a local spot-check) and passes on the current tree.
- The e2e baseline spec no longer self-skips its load-bearing assertions.
- CI schema-sync fails loudly on a missing downstream schema path, and `CI_CD_PIPELINE.md` agrees.
- Full gate green; no trivial/tautological tests; CHANGELOG + CI doc updated.
