# Shared contracts

[← PLAN.md](PLAN.md) · [overview](overview.md)

Contracts referenced by ≥2 phases. Each appears once here; phases link in. **Do not weaken** a signature without updating every referencing phase.

## `getMostRecentDayId(animal, days)` — referenced by phase-1, phase-5

The carry-forward source selector. Lives in `src/state/workspaceSelectors.js` (added in phase 1).

```javascript
/**
 * The id of the animal's latest-dated day present in `days`, or null. Day dates are `YYYY-MM-DD`
 * (lexicographic compare == chronological). Tolerates a corrupt animal, a missing `days` map, a
 * dangling id, or a record without a string `date`.
 */
export const getMostRecentDayId = (animal, days) => {
  const present = getAnimalDayIds(animal)
    .map((id) => (days && typeof days === 'object' ? days[id] : undefined))
    .filter((d) => d && typeof d.id === 'string' && typeof d.date === 'string');
  if (present.length === 0) return null;
  present.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return present[0].id;
};
```

## `createDayRecord(animal, animalId, dayId, date, session, now, carryFrom = null)` — referenced by phase-1, phase-5

The trailing `carryFrom` is a prior day record (or null). Phase 1 seeds the day-owned **session/keywords/tasks/behavioral_events/technical** from it. Phase 5 ADDS bad-channel carry-forward to the same mechanism, **guarded by config version**:

> Carry `carryFrom.deviceOverrides.bad_channels` into the new day **only when `carryFrom.configurationVersion === <the new day's pinned latestVersion>`**. The new day pins `latestVersion` (the last snapshot's `version`). If the source pinned a different version, the probe was reconfigured and the ntrode-keyed marks are stale → do NOT carry them.
>
> **Scope:** this guarded carry is for the **carry-FORWARD path only** (`createDay` → a new day pinned to `latestVersion`). **Duplicate-day** (phase 2) is a different case — it re-pins the new day to the SOURCE's version, so it carries `deviceOverrides` directly (same version by construction, no guard). Do not route duplicate through this guard or it will drop marks when the source pins a non-latest version.

Invariant: a carried day must export byte-identical to a hand-entered equivalent (merge-neutral). Bad channels are **monotonic** — never silently un-marked; removing one is an explicit edit.

## `decomposeYaml(flatModel) → { subjectId, animalFacts, dayFacts, configuration }` — referenced by phase-6a, phase-6b

The inverse of `mergeDayMetadata`. Uses the SAME inheritance contract the merge documents (`src/state/workspaceUtils.js` ≈ :281-286):

- `animalFacts` ← `subject`, `devices` (the `data_acq_device` catalog), `cameras` (catalog), `experimenter_name`/`lab`/`institution`, `optogenetics`.
- `dayFacts` ← `session_*`, `experiment_description`, `keywords`, `tasks`, `associated_files`, `associated_video_files`, `behavioral_events`, **`fs_gui_yamls`** (day-owned — `mergeDayMetadata` reads it from the day; do NOT mis-attribute it to the animal alongside the opto blocks), technical params, `subject.weight`, + the catalog references (the chosen `data_acq_device` by `name`; the day's camera refs).
- `configuration` ← `electrode_groups` + `ntrode_electrode_group_channel_map` (→ one configuration snapshot/version).
- animal-owned opto: `opto_excitation_source`, `optical_fiber`, `virus_injection`, `optogenetic_stimulation_software` (→ `animalFacts.optogenetics`). `experiment_description` is exported as `session.experiment_description || animal.experiment_description` — a flat YAML's single value is recoverable to only ONE owner; assign it to `dayFacts` (round-trips byte-identically because the day value alone reproduces the output). The original animal-vs-day split is unrecoverable; this is an accepted attribution choice.

**Correctness gate (do not weaken):** for every golden fixture `f`,
`encodeYaml(mergeDayMetadata(...recompose(decomposeYaml(decodeYaml(f))))) === f` byte-for-byte. Phase 6a builds and proves `decomposeYaml`; phase 6b consumes it for multi-file reconciliation + the import UI.
