# Task-catalog fresh-day integration runbook (Phase 8C)

The Phase 8C spec requires a **fresh-catalog-day** end-to-end check: build a YAML from a day authored
entirely through the new task-type catalog UI, convert it with `trodes_to_nwb`, and prove the NWB is
clean. This **cannot run in the agent sandbox** — the local `~/Documents/GitHub/trodes_to_nwb`
checkout is not readable (EPERM) and there is no Python environment — so it is documented here as a
manual procedure. Run it once on a machine with the pipeline installed before relying on the catalog
for real conversions.

> Why this matters: downstream validation is mostly **silent** (trodes_to_nwb's schema check only
> logs; its NWB Inspector run does not fail on findings), so the NWB file itself is the real gate. See
> [docs/PIPELINE_REQUIREMENTS.md](../PIPELINE_REQUIREMENTS.md).

## What the catalog guarantees (and why this check is the proof)

The export is **byte-identical** to the legacy inline path — `mergeDayMetadata` resolves
`day.taskInstances` back to exactly the five `TASK_ORDER` keys (`task_name`, `task_description`,
`task_environment`, `camera_id`, `task_epochs`). Golden baselines + the
`mergeTaskCatalogResolution` suite prove this for migrated days. This runbook proves it for a day
authored **from scratch** through the catalog UI (no migration involved), which the unit tests cannot
cover end-to-end.

## Procedure

1. **Author a catalog day in the app** (`npm run start`):
   1. Create an animal. On the **Task Types** tab, define ≥1 task type (e.g. `w-track` — description,
      environment, and the cameras it used). Define the cameras first on the **Cameras** tab.
   2. Add a recording day. On **Tasks & Epochs**, click **+ Add Task**, pick the task type, and assign
      its epochs. Add a second task / second epoch set if desired (ordering matters).
   3. Complete the remaining required day fields and **Export** the YAML
      (`{mmddYYYY}_{subject}_metadata.yml`).
2. **Assemble a minimal dataset**: place the exported YAML beside a matching `.rec` file (or a
   trodes_to_nwb test fixture dataset) in a data directory.
3. **Convert** with the Python pipeline:
   ```bash
   cd ~/Documents/GitHub/trodes_to_nwb
   python -c "from trodes_to_nwb.convert import create_nwbs; create_nwbs('PATH/TO/test_data', output_dir='PATH/TO/test_output')"
   ```
   Expect: conversion completes without raising; the `tasks` table in the NWB has one row per
   `taskInstance` with the catalog's name/description/environment/camera/epochs.
4. **Validate the NWB itself** (the real gate — both must pass):
   ```bash
   nwbinspector PATH/TO/test_output --config dandi    # → zero CRITICAL
   dandi validate PATH/TO/test_output                 # → exit 0
   ```
5. **Spot-check the Spyglass-relevant fields** in the NWB: `tasks` (name/description consistent —
   one description per name), camera devices resolve by `id`, and `electrode_group.location` values
   are non-empty and consistently cased.

## Pass criteria

- [ ] `create_nwbs` converts the fresh-catalog-day YAML without error.
- [ ] `nwbinspector --config dandi` reports **zero CRITICAL**.
- [ ] `dandi validate` exits **0**.
- [ ] The NWB `tasks` table matches what the catalog UI authored (no dropped/renamed tasks, no
      duplicated `task_name` with divergent descriptions).

## Cross-check against a migrated day

For confidence that authoring path and migration path agree, also export a **migrated** day (a v2 blob
loaded and re-exported) for the same animal and diff the two YAMLs' `tasks:` blocks — for equivalent
task content they must be byte-identical (this is what the in-repo `baselines` + `mergeTaskCatalogResolution`
suites assert; this step confirms it on real pipeline data).
