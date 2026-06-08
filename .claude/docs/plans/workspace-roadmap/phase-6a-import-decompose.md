# Phase 6a — YAML import: `decomposeYaml` + round-trip gate

[← PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md)

Build the inverse of the export merge: a pure function that decomposes one flat NWB-metadata YAML into the workspace's animal / day / configuration pieces, proven correct by **round-trip byte-identity** against the golden fixtures. No UI in this phase — just the function + its gate. **🟢** (it produces data that re-merges to the original).

**Inputs to read first:**

- `src/state/workspaceUtils.js` — `mergeDayMetadata(animal, day)` (the forward map; the inheritance rules it documents ≈ :281-286 ARE the decomposition contract) and the key-order constants (`SUBJECT_ORDER`, `DATA_ACQ_DEVICE_ORDER`, etc.).
- `src/io/yaml.js` — `encodeYaml` / `decodeYaml` (parse the source; re-encode for the gate).
- `src/validation/index.js` — `validate` (reject a structurally-invalid import early).
- `src/__tests__/fixtures/golden/*.yml` — the round-trip corpus (also `minimal-valid.yml`, the opto fixture, the probe-reconfig fixture).
- `src/state/workspaceTransitions.js` — `createDayRecord` / animal-creation shapes, so the decomposed pieces match what the store expects (phase 6b consumes them).

**Contracts referenced:** [`decomposeYaml`](shared-contracts.md#decomposeyamlflatmodel--subjectid-animalfacts-dayfacts-configuration--referenced-by-phase-6a-phase-6b) — including the round-trip gate (do not weaken).

## Tasks

- **`decomposeYaml(flatModel)`** (new module, e.g. `src/state/yamlImport.js`): split the flat model into `{ subjectId, animalFacts, dayFacts, configuration }` per the shared contract. `subjectId` from `subject.subject_id`. `animalFacts` = subject + `devices` (the `data_acq_device` catalog + `device`) + `cameras` + experimenters + `optogenetics`. `dayFacts` = session fields + `experiment_description` + `keywords` + `tasks` + `associated_files` + `associated_video_files` + `behavioral_events` + technical params + `subject.weight`, plus the chosen-recording-system reference (`data_acq_device[0].name` → `day.data_acq_device_name`) and the day's camera references (already inside `tasks`/`videos`). `configuration` = `electrode_groups` + `ntrode_electrode_group_channel_map`.
- **Recompose helper for the gate** (test-only or exported): assemble a minimal `animal` + `day` from the decomposed pieces in the shape `mergeDayMetadata` expects (one config snapshot at the pinned version; `data_acq_device` catalog on the animal; the day referencing it by name).
- **Round-trip gate test**: for every golden fixture `f`: `decodeYaml` → `decomposeYaml` → recompose → `mergeDayMetadata` → `encodeYaml`, assert `=== f` byte-for-byte. This is the phase's reason to exist; it must pass for all fixtures including opto + probe-reconfig.
- **Edge handling**: a structurally-invalid YAML (fails `validate`) returns a typed failure, not a partial decomposition. Document (CHANGELOG) the new module as internal (no UI yet).

## Deliberately not in this phase

- Multi-file grouping, config-version inference across dates, conflict handling, the import UI — all phase 6b.
- Importing INTO the live store — phase 6b.

## Validation slice

| Test | Asserts |
| --- | --- |
| round-trip every golden fixture | `encode(merge(recompose(decompose(parse(f))))) === f` for each `f` (incl. opto, probe-reconfig, minimal) |
| field attribution | subject/devices/cameras → animalFacts; session/tasks/files/technical → dayFacts; electrode_groups/ntrode map → configuration |
| recording-system reference | the single `data_acq_device` → animal catalog entry + `day.data_acq_device_name` pointing at it |
| invalid input | a schema-invalid YAML → typed failure, no partial result |

## Fixtures

The committed golden fixtures ARE the import corpus — no new data needed. Add one synthesized two-config edge if the probe-reconfig fixture doesn't already cover a day pinned to a non-latest version.

## Review

Dispatch `code-reviewer`. Confirm: round-trip passes for ALL golden fixtures byte-for-byte (the gate — not a subset); attribution follows the merge's documented inheritance exactly (no guessed placement); invalid input fails typed (no half-decompose); the module/test names don't reference this plan.
