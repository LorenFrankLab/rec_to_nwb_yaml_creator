# Phase 4 — Schema-valid device output: integer IDs, required fields, no ntrode-ID collisions

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#schema-device-output-contract)

Goal: make the workspace path emit electrode groups and ntrode maps the schema accepts (Finding E):
**integer** `id` / `ntrode_id` / `electrode_group_id`, the required `description` and `targeted_location`
on each electrode group, and no ntrode-ID collisions when groups are added incrementally. This changes
new-path output and standardizes the ID type **end-to-end** (the codebase currently has a string/number
split that surfaced as PropType warnings).

**Inputs to read first:**

- [src/pages/AnimalEditor/AnimalEditorStepper.jsx:24-36,225-260](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx)
  — `generateNextElectrodeGroupId` returns a string (`:33,35`); new group `id: String(startId + i)`
  (`:228`); how new groups + channel maps are merged with existing ones (`:254-260`).
- [src/pages/AnimalEditor/ElectrodeGroupModal.jsx:76-85](../../../../src/pages/AnimalEditor/ElectrodeGroupModal.jsx)
  — the saved group object; omits `description` and `targeted_location`.
- [src/utils/channelMapUtils.js:55-108](../../../../src/utils/channelMapUtils.js) —
  `generateChannelMapsForGroup` (`ntrode_id: String(...)`, `:70`; `electrode_group_id` inherited from the
  group's string id) and `generateAllChannelMaps` (`:97-108`, increments correctly within one call but
  incremental *add* can collide with pre-existing ntrodes).
- [src/nwb_schema.json:981-1002,1752-1776](../../../../src/nwb_schema.json) — electrode-group and ntrode
  item schemas: integer IDs, required fields.
- [src/pages/AnimalEditor/ChannelMapEditor.jsx](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx)
  and [src/pages/DayEditor/DevicesStep.jsx](../../../../src/pages/DayEditor/DevicesStep.jsx) — the
  PropTypes split (`ChannelMapEditor` expects string `id`; `DevicesStep` expects number); both reconciled
  to integer here.
- [src/pages/AnimalEditor/CopyFromAnimalDialog.jsx:84-105](../../../../src/pages/AnimalEditor/CopyFromAnimalDialog.jsx)
  — copy assigns new IDs as **strings** (`newId = (nextIds.nextGroupId + index).toString()`, `:88`;
  `ntrode_id: String(...)`). A second ID ingress to normalize.
- [src/utils/csvChannelMapUtils.js:170-185](../../../../src/utils/csvChannelMapUtils.js) — CSV import
  builds ntrode entries (~`:179`) producing **string** `ntrode_id` / `electrode_group_id`. A third ingress.
- [src/valueList.js](../../../../src/valueList.js) — `arrayDefaultValues` / legacy defaults for contrast
  (how the legacy form types IDs and which fields it sets).

**Contracts referenced:**

- [User mental-model contract](shared-contracts.md#user-mental-model-contract) — device and region controls
  should match how users describe implanted probes and brain locations, not just schema fields.
- [Schema device-output contract](shared-contracts.md#schema-device-output-contract) — integer IDs
  end-to-end; required `description` / `targeted_location`; unique `ntrode_id`.
- [UX mistake-prevention contract](shared-contracts.md#ux-mistake-prevention-contract) — canonical region /
  device choices should prevent typo-driven invalid or fragmented metadata.
- [Parity & golden-fixture contract](shared-contracts.md#parity-golden-fixture--round-trip-contract) — ID-type and
  added-field changes update new-path fixtures deliberately; legacy baselines stay.

## Tasks

- **Task 1 — integer electrode-group IDs.** `generateNextElectrodeGroupId` returns a number; new groups
  set `id: startId + i` (integer). Update any `parseInt(g.id, 10)` call sites that assumed strings, and
  update edit handlers such as `handleEditGroup` so a numeric id is resolved as an id, not treated as the
  whole group object.
- **Task 2 — required electrode-group fields.** `ElectrodeGroupModal` collects and saves `description`
  and `targeted_location` (add the inputs; sensible defaults are not enough — schema requires
  non-trivial strings, but a user-entered value is the goal). Persist them on the saved group. Use controlled
  choices/strong autocomplete for `location` and `targeted_location` seeded from the existing region list;
  allow "other" only when the emitted string is trimmed, non-empty, and not a case-only duplicate of an
  existing canonical region value. If a user types `ca1` while `CA1` is known, snap to/suggest the canonical
  `CA1` value instead of saving a fragmented spelling. Phase 6 still adds cross-workspace warnings for
  already-existing mixed-case drift.
- **Task 3 — integer ntrode IDs + no collisions.** In `channelMapUtils.js`, emit integer `ntrode_id`
  and integer `electrode_group_id`. When generating maps for a *newly added* group, start `ntrode_id`
  after the current maximum existing `ntrode_id` across the animal (not at 0), so incremental adds never
  collide. Add a helper `nextNtrodeId(existingMaps)` and use it at the add site in `AnimalEditorStepper`.
  Also validate electrode-group `id` uniqueness within the day/session; `trodes_to_nwb` names the NWB
  electrode group from this id and Spyglass keys `ElectrodeGroup` by session + group name, so duplicate
  group ids can collapse groups downstream.
- **Task 3b — per-shank electrode-ID offset (multi-shank probes).** `generateChannelMapsForGroup`
  (`channelMapUtils.js:61-76`) emits an **identical** map for every shank, so a 4-shank probe outputs
  `0..31` four times instead of `0..31, 32..63, 64..95, 96..127`. Offset shank `i`'s value for local key
  `idx` by `i * deviceTypeMap(device_type).length` (mirror `useElectrodeGroups.js:81`). See
  [channel-map semantics](designs.md#multi-shank-per-shank-offset-generator-fix--phase-4). Add a fixture
  test for a 128-channel 4-shank probe asserting the four blocks.
- **Task 3c — drop stray non-schema keys.** `ElectrodeGroupModal` saves a `bad_channels` *string* onto the
  electrode group (`ElectrodeGroupModal.jsx:83`) and `generateChannelMapsForGroup` adds `electrode_id: 0`
  to each ntrode (`channelMapUtils.js:71`) — neither is a schema field, and both ride into the YAML via
  `reorderKeys`. Remove them at the source (electrode-group save / ntrode generation).
- **Task 3d — default `device.name`.** `device.name` is schema-required (`minItems:1`, string pattern) but
  the workspace emits `name: []` (Home `:79`, `createAnimal` `:148`). Default it to `['Trodes']` at
  `createAnimal` (legacy value), or collect it. (trodes_to_nwb ignores top-level `device`, but it fails
  schema validation and the export gate.)
- **Task 4 — normalize IDs at every ingress, not just generation.** Generated IDs (Tasks 1, 3) are one
  path; also normalize: **copy** (`CopyFromAnimalDialog.jsx:88` — `.toString()` → integer; new `ntrode_id`
  integer) and **CSV import** (`csvChannelMapUtils.js:179` — parse `ntrode_id` / `electrode_group_id` to
  integers, and renumber on import so imported ntrodes don't collide with existing ones). Any path that
  introduces a group or ntrode must produce integer IDs.
- **Task 5 — reconcile PropTypes to integer.** Change `ChannelMapEditor` (and any sub-prop) and confirm
  `DevicesStep` to expect **integer** `id` / `ntrode_id` / `electrode_group_id`. Remove the string
  assumptions; this clears the contradictory-PropType warnings noted in the v3 follow-ups.
- **Task 6 — fixtures + docs.** Update new-path parity fixtures to integer IDs + the new required fields;
  review the byte diff (string→integer IDs, added `description`/`targeted_location`). Update
  `docs/REFACTOR_CHANGELOG.md`. Gate on `schemaValidation(mergeDayMetadata(...))` zero-error + the in-app
  DANDI/Spyglass rules; the downstream round-trip is deferred to the pre-cutover task.

## Deliberately not in this phase

- **Probe resolution / bad-channel merge** — phase 2 (this phase assumes the resolved devices flow to
  export; it only fixes their *shape*).
- **DOB format** — phase 5.
- **Dangling `electrode_group_id` reference validation** — phase 6 (this phase makes the *types* valid;
  phase 6 catches references to a non-existent group).

## Validation slice

| Test | Asserts |
| --- | --- |
| `new electrode-group IDs are integers` *(unit)* | adding groups yields integer `id` values (0, 1, 2…), not strings. |
| `numeric electrode-group id edit path works` *(integration)* | editing by numeric id resolves the group object and saves without `editingGroup.id` becoming undefined. |
| `saved electrode group includes description and targeted_location` *(integration)* | the ElectrodeGroupModal save path includes both required fields with the entered values. |
| `region fields use controlled/canonical entry` *(integration)* | location/targeted_location can be selected from known regions or entered via a validated "other" path; whitespace-only/empty values cannot be saved. |
| `region other path prevents case-only drift` *(integration)* | typing a case-only variant of a known region (for example `ca1` when `CA1` exists) selects/suggests the canonical known value instead of saving a new fragmented value. |
| `ntrode IDs are integers and unique across incremental adds` *(unit)* | adding a second group after a first does not restart `ntrode_id` at 0; all `ntrode_id` integers are distinct. |
| `electrode-group IDs are unique` *(unit)* | duplicate group ids are rejected before export; group names in the NWB/Spyglass path cannot collapse. |
| `copy from animal produces integer IDs` *(unit)* | `CopyFromAnimalDialog`'s copied groups/ntrodes have integer `id` / `ntrode_id` / `electrode_group_id`, not strings. |
| `CSV import produces integer, non-colliding ntrode IDs` *(unit)* | importing channel maps yields integer `ntrode_id` / `electrode_group_id` and renumbers to avoid collision with existing ntrodes. |
| `multi-shank probe offsets electrode IDs per shank` *(unit)* | a 128ch 4-shank probe generates ntrode maps with values `0..31`, `32..63`, `64..95`, `96..127`; a single tetrode group is `0..3`; a second tetrode group resets to `0..3`. |
| `exported devices carry no stray keys` *(unit)* | the merged electrode groups have no `bad_channels` string and ntrodes have no `electrode_id`; `device.name` is non-empty. |
| `merged device output passes schema` *(unit)* | `schemaValidation(mergeDayMetadata(animal, day))` returns zero errors for a fully-configured session (was failing on ID type + missing fields). |
| `ChannelMapEditor/DevicesStep render with integer IDs without PropType warnings` *(integration)* | rendering with integer IDs produces no PropType console error. |
| `phase-4 corrected-device sample is schema-valid` *(integration)* | a corrected sample with integer IDs, required device fields, no stray keys, and multi-shank offsets has zero `schemaValidation` errors and passes the in-app device-type/identity rules. |
| `golden-yaml.baseline.test.js` (existing) | byte-identical — legacy fixtures unchanged. |

Automated app tests are Vitest. The real downstream round-trip is deferred to a single pre-cutover task
(see the round-trip contract).

## Fixtures

`makeConfiguredWorkspace()` / inline animals with integer-ID devices; `ElectrodeGroupModal` for the
save-path and canonical-region tests; new-path parity fixtures updated per the parity contract.

## Review

`pr-review-toolkit:code-reviewer`; `ux-reviewer`; `pr-review-toolkit:type-design-analyzer` (the ID type is a
cross-cutting contract — confirm it's integer end-to-end with no boundary string-coercion). Confirm: schema
validity proven, not assumed; controlled region entry prevents empty/case-fragmented values before export;
PropType split eliminated; collision guard tested with a real two-group add; fixture byte diff intentional;
legacy baselines unchanged; no plan/phase strings.
