# Downstream Pipeline Requirements: trodes_to_nwb · DANDI · Spyglass

**What this is.** The YAML this app generates is consumed by `trodes_to_nwb` (→ NWB), then published to
**DANDI** and ingested into **Spyglass**. Each of those imposes requirements *beyond* `nwb_schema.json` —
and most violations fail **silently** (wrong/missing data, no error). This document records the verified
requirements and, just as importantly, **how to re-verify them** when the downstream code changes.

> ⚠️ **Provenance & staleness.** Verified 2026-06-04 against `trodes_to_nwb@main`, `spyglass@master`, the
> live DANDI/NWB-Inspector docs, and this repo's code. Downstream repos move — treat every claim here as
> "true as of that date" and **re-verify with Part 5 before relying on it for a new change.** Where a fact
> is version-sensitive it is flagged. (One CLAUDE.md claim was already found stale — see §Spyglass, probe
> registration.)

---

## 1. trodes_to_nwb (the converter)

**The single most important fact:** trodes_to_nwb's own schema validation **only logs, never raises**
(`metadata_validation.validate` returns `(is_valid, errors)`; `convert_yaml.load_metadata` logs and
proceeds), and its NWB Inspector runner prints/saves but does **not** raise (`convert.py` ~`:377`). So the
schema is *advisory* downstream — **this app's validation is the real gate.** The converter's actual
failures are `KeyError`/`ValueError`/`FileNotFoundError` in the `add_*` functions; everything else is
silent.

Top-level **schema-required** keys are only: `experimenter_name`, `lab`, `institution`, `data_acq_device`,
`times_period_multiplier`, `raw_data_to_volts`. But the converter *code* unconditionally reads `subject`,
`electrode_groups`, `ntrode_electrode_group_channel_map`, `cameras`, `tasks` → omitting them passes schema
but `KeyError`s at conversion.

| YAML section | What the converter does | Hard failure (raises) | Silent corruption |
| --- | --- | --- | --- |
| `subject` | splatted into `pynwb.Subject(**dict)`; `weight` → `f"{weight} g"` | an **extra/unknown** subject key → `TypeError`; missing `weight` (used directly) | DOB passed through as-is; if YAML auto-parses it to a `datetime`, that reaches pynwb |
| `date_of_birth` | passed to `Subject` | — | schema pattern wants a `T`-timestamp; a bare `YYYY-MM-DD` fails schema (advisory). Emit a full ISO-8601 datetime string |
| `data_acq_device` | **array**, iterated; reads `system`/`amplifier`/`adc_circuit` | missing any of those three → `KeyError` | **`name` is NOT read** — device named `dataacq_device{i}`. A single object instead of an array breaks iteration |
| `device.name`, top-level `units` | **never consumed** | — | dead metadata for conversion (only `electrode_groups[].units` is read). Still schema-validated, so keep them valid |
| `electrode_groups[]` | reads `id`,`description`,`location`,`targeted_location`,`targeted_x/y/z`,`units`,`device_type` | any missing → `KeyError`; non-numeric `targeted_x/y/z` → `ValueError`; **`device_type` not matching a `probe_metadata/*.yml` `probe_type` (exact, case-sensitive)** → `FileNotFoundError` | per-electrode table `location` comes from **`targeted_location`**, not `location`; geometry comes from the probe file, not the YAML |
| `ntrode_..._channel_map[].map` | keys = header position (0-based, local); **values = probe electrode IDs** | `len(map)` ≠ header group channel count → `ValueError`; yaml ntrodes > header → `IndexError` | values are **per-probe electrode IDs reset per group** (a 2nd tetrode is `0..3`, *not* `4..7`); multi-shank probes partition `0..N-1` across shanks |
| `…[].electrode_group_id` / `id` | matched group↔ntrode by `==` (**not** str-coerced in `add_electrode_groups`) | type drift (str vs int) → `KeyError`/`TypeError` | — |
| `…[].ntrode_id` | matched to header, **str-coerced** (tolerant) | missing yaml ntrode for a header ntrode → `KeyError` | — |
| `…[].bad_channels` | `bool(electrode_index in bad_channels)` | — | **probe-local 0-based electrode indices**; out-of-range values are **silently ignored** (nothing flagged) |
| `cameras[]` | array; reads `id`,`model`,`manufacturer`,`meters_per_pixel`,`lens`,`camera_name` | missing any → `KeyError` | NWB device named `camera_device {id}` (Spyglass parses the numeric id from this) |
| `tasks[].camera_id`, `.task_epochs` | **arrays** of ints | non-numeric → `TypeError` | **no dangling-camera-id check** — a bad id is written silently |
| `associated_files[].task_epochs` | **scalar** int (list-wrapped by loader) | — | missing `path` → logged, file created with empty content |
| `associated_video_files[]` | `task_epochs` **scalar**, `camera_id` **scalar** | missing video file → `FileNotFoundError` | — |
| `behavioral_events[]` | `description` = **hardware DIO name** (matched to `.rec`); `name` = label | **duplicate `description`** → `ValueError` | a `description` that matches no hardware channel → silent empty event series |
| optogenetics | gate over `[virus_injection, opto_excitation_source, optical_fiber, optogenetic_stimulation_software]` (each present **and** `len>0`) | when triggered: `opto_excitation_source` `len>1` → `ValueError`; unknown device names → `ValueError` | **if any of the four is missing/empty → ALL optogenetics is silently skipped** |

**Optogenetics key mismatches (schema ≠ converter — emit the converter spelling):** the converter reads
`optogenetic_stimulation_software` (schema property is `opto_software`) and `virus_injection[].volume_in_uL`
(capital L; schema is `volume_in_ul`). Emitting the schema spelling makes opto silently vanish. Coordinate
a `nwb_schema.json` fix across both repos.

**Probe set (verify the app's `deviceTypes()` ⊆ this).** `device_type` must equal a `probe_type` in
`trodes_to_nwb/src/trodes_to_nwb/device_metadata/probe_metadata/` (12 files as of the verify date):
`tetrode_12.5`, `A1x32-6mm-50-177-H32_21mm`, eight `128c-4s*` variants, `32c-2s8mm6cm-20um-40um-dl`,
`64c-3s6mm6cm-20um-40um-sl`, `64c-4s6mm6cm-20um-40um-dl`, `NET-EBL-128ch-single-shank`.

---

## 2. DANDI conformance

DANDI validates in three layers: **PyNWB** (structural), **NWB Inspector with the DANDI config** (only
`CRITICAL` results block upload), and **dandischema** (requires Subject `subject_id` + `species`). `dandi
validate` **exits non-zero** on any blocking violation.

**Blocking subject checks (promoted to CRITICAL by the DANDI Inspector config):**

| Check | Rule | App field today |
| --- | --- | --- |
| `check_subject_species_form` | `species` is a **Latin binomial** (`^[A-Z][a-z]+ [a-z]+$`, e.g. `Rattus norvegicus`) **or** an NCBI Taxon URI. **Free text (`Rat`, `Long Evans`) FAILS.** | free text — the schema's example is literally `"Rat"` ❌ |
| `check_subject_species_exists` | non-empty | required ✓ |
| `check_subject_sex` | one of `M`/`F`/`O`/`U`, upper-case | `enum: M/F/U/O` ✓ |
| `check_subject_id_exists` / `check_subject_exists` | present | required ✓ |
| `check_subject_id_no_slashes` / `check_session_id_no_slashes` | no `/` in `subject_id`/`session_id` | not enforced ❌ |
| `check_subject_age` / `check_subject_proper_age_range` | `age` (ISO-8601 duration) **or** `date_of_birth` present | DOB satisfies once it's a valid timestamp ✓ (after the planned fix) |

**Best-practice (warn, do not block):** `experimenter` in `Last, First` form; `institution`; `keywords`;
timezone-aware `session_start_time`/`date_of_birth`.

---

## 3. Spyglass ingestion & naming identity

Spyglass (`@master`) ingests via a declarative `SpyglassIngestion` base; per-table `make()` is wrapped in
`try/except` that logs to an **`InsertError` side table and continues**. So **most metadata problems are
silent data fragmentation/loss, not crashes** — which makes app-side validation the safety net. Several
YAML fields become **database identities / primary keys**:

| YAML field | Spyglass role | Violation → effect |
| --- | --- | --- |
| `cameras[].camera_name` | `CameraDevice` **primary key** (`common_device.py`) | reuse with different `meters_per_pixel`/`lens`/`model`/`manufacturer` → divergence error or **wrong calibration reused**. Changed zoom/calibration ⇒ **new `camera_name`** |
| `cameras[].id` | numeric id parsed from NWB name `camera_device {id}` (`common_task.py`, `common_behav.py`) | keep integer + unique |
| `data_acq_device[].name` | `DataAcquisitionDevice` identity (`common_device.py:60,190`) | same name + different `system`/`amplifier`/`adc_circuit` → divergence check; unregistered device in interactive mode → `PopulateException` |
| `tasks[].task_name` | secondary-key consistency (`common_task.py:20`) | same name + different `task_description` → **raises** |
| `electrode_groups[].location` **and** `targeted_location` | auto-create `BrainRegion` by **exact string** (`common_region.py:44`, no trim/case-fold) | spelling/case drift (`CA1` vs `ca1`) → **silent region fragmentation**; empty → junk region |
| Electrode ndx columns `probe_shank`/`probe_electrode`/`bad_channel`/`ref_elect_id` + device is an ndx Probe | electrode↔probe linkage + bad-channel/reference (`common_ephys.py`) | any missing → **silent** degraded electrode rows (no linkage/flags), warning only |
| `behavioral_events[].name` | `DIOEvents` PK `(Session, dio_event_name)` (`common_dio.py`) | duplicate name in a session → **hard** PK violation |
| `associated_video_files[]` | `VideoFile` depends on a successful `TaskEpoch` (`common_behav.py:451`, `common_task.py:240`) | video without matching task metadata / camera → **silently not imported** |
| `session_description`, `session_start_time` | `Session` NOT NULL (`common_session.py`) | missing → **hard** Session failure |

**Hard stops (the rest are silent):** missing `session_description`/`session_start_time`, duplicate
`behavioral_events` name, duplicate `task_name` with conflicting description, and (interactive mode) an
unregistered `DataAcquisitionDevice`.

**Stale CLAUDE.md claim (corrected):** "undefined probe type → `ElectrodeGroup.probe_id` NULL → data loss"
described an older mechanism. On `master`, `ProbeType` is **auto-registered from the NWB `ndx_franklab_novela.Probe`**
(geometry included), and `probe_id` is taken from the device's `probe_type` attribute. The real risk is an
electrode group whose device **isn't a proper ndx Probe with `probe_type` + geometry** → silent NULL
`probe_id`. Spyglass does **not** ingest subject `weight`/`date_of_birth` (those matter for NWB/DANDI only).

---

## 4. Field requirement matrix (quick lookup)

For each YAML field: who requires it and where it's (or isn't) enforced in this app. "Schema" = bundled
`nwb_schema.json`.

| Field | Schema | trodes_to_nwb | DANDI | Spyglass |
| --- | --- | --- | --- | --- |
| `subject.weight` | **required** | used (`{w} g`) | — | not ingested |
| `subject.species` | non-empty | passthrough | **Latin binomial / URI (blocker)** | ingested as-is |
| `subject.sex` | enum M/F/U/O | passthrough | **M/F/O/U (blocker)** | normalized |
| `subject.date_of_birth` | `T`-timestamp pattern | passthrough | **age-or-DOB (blocker)** | not ingested |
| `subject_id` / `session_id` | non-empty | — | **no-slash (blocker)** | `session_id` nullable |
| `device.name` | required `minItems:1` | **ignored** | — | — |
| `data_acq_device[]` | required array, `name`+3 | `name` ignored, 3 required | — | `name` = identity |
| `electrode_groups[].id` etc. | integer ids, required fields | required, `==` match | — | linkage |
| `…location` / `targeted_location` | required | `targeted_location` drives electrodes | — | **BrainRegion exact-string** |
| `ntrode map values` | object | **probe electrode IDs, per-group, bounded** | — | — |
| `bad_channels` | int array | **local indices, silent if OOB** | — | electrode flags |
| `cameras[].lens`/`camera_name` | required | required | — | `camera_name` = PK |
| `tasks[].camera_id` (array) / `behavioral_events[].name` | — | array; dup DIO name raises | — | dangling silent / DIO name PK |
| `associated_video_files[].camera_id` (scalar) | integer | scalar | — | needs TaskEpoch |
| optogenetics (4 sections) | optional | **all-or-nothing, silent skip; key mismatches** | — | — |

---

## 5. How to re-verify (do this before trusting the above for a new change)

The local sibling checkouts of `trodes_to_nwb` / `spyglass` under `~/Documents/GitHub/` are **not
readable from the agent sandbox** (`stat` works, `open()` is EPERM, even with the sandbox disabled — the
harness blocks file *contents* outside the project root). So **read them from GitHub**, not locally.

**Repos & docs:**
- trodes_to_nwb — <https://github.com/LorenFrankLab/trodes_to_nwb> (branch `main`)
- spyglass — <https://github.com/LorenFrankLab/spyglass> (branch `master`)
- DANDI validation — <https://docs.dandiarchive.org/user-guide-sharing/validating-files/>
- NWB Inspector DANDI config — `nwbinspector` repo `src/nwbinspector/_internal_configs/dandi.inspector_config.yaml`; checks at <https://nwbinspector.readthedocs.io/en/dev/api/checks.html>

**Method (use `WebFetch`; load it via `ToolSearch` "select:WebFetch" first):**
- List a dir: `WebFetch https://api.github.com/repos/<org>/<repo>/contents/<path>`
- Read a file: `WebFetch https://raw.githubusercontent.com/<org>/<repo>/<branch>/<path>`
- The load-bearing files:
  - trodes_to_nwb: `src/trodes_to_nwb/convert_yaml.py` (the `add_*` functions), `convert_rec_header.py`
    (`make_hw_channel_map`, header validation), `metadata_validation.py` (validator), `convert.py`
    (inspector runner), `convert_optogenetics.py`, and `device_metadata/probe_metadata/` (the probe set).
  - spyglass: `src/spyglass/common/common_{device,ephys,region,session,subject,task,dio,behav}.py` and
    `populate_all_common.py`.
- DANDI: read the validating-files doc, then the Inspector `dandi.inspector_config.yaml` for the CRITICAL
  list, then specific checks in the Inspector check API.

**Validate an actual NWB file (the real gate, not "it converted"):**
```bash
# convert a sample (.rec + generated YAML) with trodes_to_nwb, then:
nwbinspector <file.nwb> --config dandi    # must report ZERO CRITICAL
dandi validate <file.nwb>                  # must exit 0
```

**Efficient sweep:** dispatch parallel research agents — one per target (local code, trodes_to_nwb,
spyglass, DANDI) — each told to report *confirmed / contradicted / new* facts with file:line or doc
citations. That is how the 2026-06-04 verification was done; it covers the surface in one pass.

**When you re-verify, update this doc's provenance line and any changed facts**, and reconcile CLAUDE.md's
integration sections + the active plan (`.claude/docs/plans/…`) with what changed.
