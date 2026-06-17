# Downstream verdict — what trodes_to_nwb actually does with the corpus-2 error classes

**Date:** 2026-06-17 · **Verified against:** local `trodes_to_nwb` checkout at
`/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/`, HEAD `65ec81a` (2026-06-16),
plus the installed `ndx-ophys-devices` / `ndx-optogenetics` specs the converter writes into.
**Method:** read the loader + every consumer of each field; confirmed unit semantics from the ndx
extension YAML spec (not assumed). **Inputs:** `03-synthesis.md` error catalogue (this folder).

> **Top-line correction to the synthesis:** the catalogue's load-bearing assumption — "downstream is
> silent, so wrong YAML lands verbatim and converts successfully" — is **only partly true on the
> current converter**, and the corrections move two headline errors from SILENT to LOUD:
> - **Space-separated keys (#1) are now a LOUD `KeyError`/`IndexError` hard-fail** in a normal ephys
>   conversion, not a silent total electrode loss — *unless* the caller passes `behavior_only=True`.
> - **The volume 1000× conflict (#2) does NOT corrupt the NWB**: the converter reads only
>   `volume_in_uL` (capital L = the correct `0.45`) and never reads `volume_in_ul` (lowercase 450).
>   The shipped value is correct; the lowercase key is dead.
> - **Power (#3) is confirmed a real silent corruption**: `power_in_W: 200` lands verbatim as **200 W**.
>
> Everything in this doc is current-HEAD. An *older* converter (the one the prior 325-study read) may
> have lacked the data_scanner / `validate_yaml_header_electrode_map` raises — those are recent
> (`#170`/`#179`, 2026). If the corpus was collected against an older pipeline, #1's "silent" verdict
> was correct *then*; it is loud *now*.

---

## Per-error verdict table

| # (cat) | Error | What the converter does | What lands in the NWB | Silent / Loud | Evidence (file:line) | Conf. |
|---|---|---|---|---|---|---|
| **1** | Space-separated top-level keys (`electrode groups:` / `ntrode electrode group channel map:`) | `yaml.safe_load` keys verbatim, so `electrode_groups`/`ntrode_electrode_group_channel_map` are **absent**. In a normal (ephys) run, `validate_yaml_header_electrode_map` then **subscripts the missing key directly** → `KeyError`, before any NWB is written. | Nothing — conversion **aborts**. (If run with `behavior_only=True`, the electrode path is skipped entirely → a behavior-only NWB with **zero electrodes, silently**.) | **LOUD hard-fail** (normal run) / **SILENT** (behavior_only) | `convert_rec_header.py:122` (`metadata["ntrode_electrode_group_channel_map"]` subscript) → raises `KeyError` line 128; also `convert.py:348` calls it before the `behavior_only` guard at `convert.py:372`. `behavior_only` is a caller flag defaulting `False` (`convert.py:198`). | HIGH |
| **2** | Volume 1000× conflict (`volume_in_uL: 0.45` **vs** `volume_in_ul: 450`) | Reads **`volume_in_uL` (capital L) only**; `volume_in_ul` (lowercase) is never referenced. Value passed verbatim through `float()` to the ndx `ViralVectorInjection.volume_in_uL` field. **No unit conversion** (the ndx field IS microliters). | `volume_in_uL = 0.45` (µL) — **the correct value.** The lowercase `450` is inert. *If* `volume_in_uL` is absent and only `volume_in_ul` present → `KeyError` (loud). | **NOT a corruption** (verbatim-correct); LOUD only if capital-L key missing | read at `convert_optogenetics.py:290` (`float(virus_injection_metadata["volume_in_uL"])`); unit confirmed in spec: `ndx-ophys-devices.extensions.yaml` ViralVectorInjection `volume_in_uL` doc = "Volume of injection, in uL., e.g., 0.45 uL (450 nL)" | HIGH |
| **3** | `power_in_W: 200` (model number typed into watts field) | `float(source_metadata["power_in_W"])` → straight into ndx `ExcitationSource.power_in_W`. No range check, no conversion. | `power_in_W = 200.0` **Watts** verbatim (~10,000× the real ~0.02 W). Real per-epoch power lands separately and correctly as `power_in_mW` on the opto-epochs table. | **SILENT corruption** | written `convert_optogenetics.py:131`; spec `ExcitationSource.power_in_W` doc = "Incident power of stimulation device (in Watts)"; real power read `convert_optogenetics.py:503` (`float(fs_gui_metadata["power_in_mW"])`) | HIGH |
| **4** | Unresolvable `device_type` (`screw`, `single_electrode`, typo `…15um-40um…`, legacy `tetrode`) | Linear scan over loaded probe metadata for `probe_type == device_type`; no match → `raise FileNotFoundError`. | Nothing — conversion aborts. | **LOUD hard-fail** | `convert_yaml.py:214-221` (`raise FileNotFoundError(f"No probe metadata found for {…device_type}")`) | HIGH |
| **5** | species non-binomial (`Rat`) | trodes schema only requires a non-blank string (`pattern: ^…\S…$`) → **passes** trodes validation; written verbatim to `Subject.species`. DANDI is the gate, not trodes. | `species = "Rat"` verbatim → **DANDI rejects** at publication. | DANDI-reject (trodes silent) | schema `subject.species type:string pattern non-blank` (no enum/binomial check); written `convert_yaml.py:124` via `Subject(**subject_metadata)` | HIGH |
| **6** | sex non-single-letter (`Male`) | trodes schema **does** enum-restrict `sex` to `M/F/U/O` → fails schema, **but validation only logs** (never raises). Then `Subject(sex="Male")` is written; pynwb does not enforce the enum. | `sex = "Male"` verbatim → DANDI/NWB-inspector flags. | DANDI-reject; schema-fail is **logged-only** | schema `subject.sex enum:[M,F,U,O]`; validator collects→logs `metadata_validation.py:69-77` + `convert_yaml.py:59-61` (`logger.exception`, no raise) | HIGH |
| **7** | Same-animal DOB/genotype/species conflict (re-typed daily) | Each day is its own YAML/NWB; the converter has no cross-day view. Whatever that day's file says is written verbatim. | Per-session NWB carries that day's (possibly wrong) static fact. No downstream catch. | **SILENT corruption** | structural — `add_subject` writes per-file `convert_yaml.py:120-124`; no cross-file reconciliation anywhere | HIGH |
| **8** | DOB missing | trodes schema marks `date_of_birth` **required under subject** → schema-fail (logged-only). `add_subject` then `Subject(**subject_metadata)` — pynwb accepts a missing/None DOB. | NWB with no DOB → DANDI needs age-or-DOB. | DANDI-reject; schema-fail logged-only | schema `subject.required` includes `date_of_birth`; logged not raised (as #6) | HIGH |
| **9** | weight string-with-unit (`"541g"`) | trodes schema types `weight` as **`number`** → string fails schema (logged-only). `add_subject` does `f"{weight} g"` → would yield `"541g g"`. pynwb `Subject.weight` is a free string, so it's accepted. | `weight = "541g g"` (malformed) or, if numeric, `"541 g"`. | DANDI-reject/schema; logged-only | schema `subject.weight type:number`; `convert_yaml.py:122` (`f"{subject_metadata['weight']} g"`) | HIGH |
| **10** | NULL-like `location` on ACTIVE group | Written verbatim to `NwbElectrodeGroup.location`; no emptiness check. | Empty/`None`/`NotInBrain` location string → Spyglass auto-creates an "Unknown" BrainRegion. | **SILENT** (Spyglass-fragment) | `convert_yaml.py:237` (`location=egroup_metadata["location"]`) | HIGH |
| **11** | `location` case/typo fragmentation | Verbatim to `location`; no normalization. | `hippocampus`/`Hippocampus`/`hippcoampus` each become a distinct Spyglass BrainRegion. | **SILENT** (Spyglass-fragment) | `convert_yaml.py:237` (same) | HIGH |
| **12** | strain in genotype field (`Long-Evans Rat`) | Verbatim to `Subject.genotype`. | Wrong genotype semantics in Spyglass. | **SILENT** (wrong semantics) | `convert_yaml.py:124` (`Subject(**subject_metadata)`) | HIGH |
| **13** | `times_period_multiplier: "1.5cd"` (string in number field) | Schema types it `number` → fails schema (logged-only). **It is then NOT consumed anywhere in the conversion code** (only referenced in tests). | Nothing downstream reads it → no corruption, no crash; only the (ignored) schema log. | **Schema-fail logged-only → effectively ignored** | schema `times_period_multiplier type:number`, in top-level `required`; **zero** non-test consumers (`grep`: only `tests/`) | HIGH |
| **14** | `task_epoch`/`task_epochs` key split + scalar/list typing | `load_metadata` **force-wraps** `associated_files[].task_epochs` and `associated_video_files[].task_epochs` each in a list: `file["task_epochs"] = [file["task_epochs"]]`. Assumes the **plural** key exists. A file using the **singular** `task_epoch` key → `KeyError` on that wrap (loud); a scalar under the plural key is coerced to `[scalar]` (harmless). | If plural+scalar: correct `[n]`. If singular key: abort. | **Coerced (scalar)** / **LOUD (singular key)** — *not* silent partial loss as the catalogue feared | `convert_yaml.py:66-71` (unconditional `[file["task_epochs"]]`); consumed `convert_yaml.py:392-396, 445` | HIGH |
| **15** | camera_id dangling reference | `add_cameras` builds devices named `camera_device {id}`. `add_tasks` writes `task_metadata["camera_id"]` into a VectorData **without checking the camera exists** — no lookup at task-build time. (The opto path DOES look up the camera device and raises — `convert_optogenetics.py:593-598` — but only when a speed/spatial filter is active.) | Task table stores a camera_id with no matching `camera_device` → video/position link can't resolve downstream. | **SILENT** (broken link) for tasks; LOUD only on the opto-filter path | `convert_yaml.py:387-391` (no existence check); opto-path raise `convert_optogenetics.py:593-598` | HIGH |
| **16** | Space-key wholesale → missing `subject_id` | `subject_id` is schema-required (logged-only if absent). `add_subject` does `Subject(**subject_metadata)` — pynwb requires a non-None `subject_id`? It accepts None → empty Subject. With a legacy `subject id:` space key, the real id is dropped. | NWB Subject with no/empty subject_id. | DANDI-reject / Spyglass-fragment; schema logged-only | schema `subject.required` includes `subject_id`; `convert_yaml.py:120-124` | HIGH |
| **17** | Out-of-range `bad_channel` (`[4]` on a 0–3 tetrode) | `bad_channel` flag is `bool(electrode_counter_probe in channel_map["bad_channels"])` per electrode. An out-of-range index simply never matches any electrode → **silently ignored**; the real failing channel is **not** flagged bad. | All electrodes `bad_channel=False`; the intended-bad channel is kept as good. | **SILENT corruption** | `convert_yaml.py:286-289` (`bool(electrode_counter_probe in channel_map["bad_channels"])`) | HIGH |
| **18** | Unparseable YAML syntax | `yaml.safe_load` raises before anything else. | Nothing — aborts. | **LOUD hard-fail** | `convert_yaml.py:53-54` (`yaml.safe_load(stream)`) | HIGH |
| **19** | Intra-day cross-copy disagreement | Per-file; converter ingests whichever copy it's pointed at. Deterministic per input, non-deterministic across copies. | Whichever copy's bad_channels. | **SILENT** (non-deterministic across copies) | structural — single-file conversion | MED-HIGH |
| **20** | `raw_data_to_volts` placeholder (`1`/`0`/`None`) or alt `2.95e-7` | **Only used as a fallback** when the `.rec` header lacks `rawScalingToUv` (it usually has it → metadata value often unused). When used: `metadata["raw_data_to_volts"] * MICROVOLTS_PER_VOLT`. `None` → `TypeError` (loud); `1`/`0` → wrong scaling silently; string → `TypeError`. | If header has `rawScalingToUv`: metadata ignored (no effect). Else `1`→1e6× wrong µV scaling, silent. | **Header-dependent**: usually ignored; else SILENT (numeric) / LOUD (`None`/string) | `convert_ephys.py:378-383` (`if "rawScalingToUv" in spike_config[0].attrib: … else metadata[...]`) | HIGH |
| **21** | `units` 6-way encoding (`"'unspecified'"` etc.) | `units` is metadata-only; written into the units structure verbatim, no normalization. | Cosmetic string variance; double-quoted value is literally wrong text. | **COSMETIC → MED** | no consumer beyond verbatim metadata; schema string | MED |
| **22** | DANDI-tolerant free-text drift (`lab`, `default_header_file_path:''`, `data_acq_device.system`) | Verbatim. `default_header_file_path` empty passes schema? schema pattern requires non-blank → fails (logged-only) but unused in convert. | Verbatim strings; mild Spyglass fragmentation. | **COSMETIC / mild Spyglass-fragment** | `convert_yaml.py:91-105` (lab/institution verbatim) | MED |
| **23** | Orphan/dangling ntrode `electrode_group_id` | `make_hw_channel_map` does `channel_map = None` then dereferences `channel_map["electrode_group_id"]` if no ntrode matches → `TypeError` (loud); a dangling eg→ntrode mismatch in `add_electrode_groups` leaves `channel_map=None` then `channel_map["ntrode_id"]` → `TypeError`. | Abort (TypeError) in most off-by-one shapes. | **LOUD** (mostly) | `convert_rec_header.py:166-171`; `convert_yaml.py:206-211, 284` | MED-HIGH |
| **24** | MMDDYYYY filename | `data_scanner` parses the leading 8 chars; `date = int(date)` then **sorts by that integer**. `06222023` parses as a valid int but sorts in the wrong band vs `2023…`; if the stem otherwise fails the strict 3-token `.yml` unpack it's skipped-with-warning (yml is auxiliary). For session-data extensions a botched name now **raises**. | Mis-grouped / mis-ordered sessions, or loud abort for `.rec`-class files. | **LOUD (session-data) / SILENT mis-order (date int)** | `data_scanner.py:104-119` (`date=int(date)`), sort `:220`; abort `:198-209` | HIGH |
| **25** | Placeholder `subject_id` (`12345`) in a real dir | Verbatim to Subject. | Real session labeled with template id → Spyglass fragment. | **SILENT** (Spyglass-fragment) | `convert_yaml.py:120-124` | HIGH |

---

## Authoritative known-probe list (the catalog to pin)

The converter matches `electrode_groups[].device_type` against the **`probe_type` field inside** each
file in `device_metadata/probe_metadata/` (the match is on the field value, not the filename — they
are identical here). Lookup is exact, case-sensitive (`convert_yaml.py:214-215`); no match →
`FileNotFoundError` (`convert_yaml.py:218-221`).

**12 probe files; 12 distinct `probe_type` values** (verified by grepping `probe_type:` in each file):

| # | filename | `probe_type` (the catalog string) |
|---|---|---|
| 1 | `128c-4s4mm6cm-15um-26um-sl.yml` | `128c-4s4mm6cm-15um-26um-sl` |
| 2 | `128c-4s4mm6cm-20um-40um-sl.yml` | `128c-4s4mm6cm-20um-40um-sl` |
| 3 | `128c-4s6mm6cm-15um-26um-sl.yml` | `128c-4s6mm6cm-15um-26um-sl` |
| 4 | `128c-4s6mm6cm-20um-40um-sl.yml` | `128c-4s6mm6cm-20um-40um-sl` |
| 5 | `128c-4s8mm6cm-15um-26um-sl.yml` | `128c-4s8mm6cm-15um-26um-sl` |
| 6 | `128c-4s8mm6cm-20um-40um-sl.yml` | `128c-4s8mm6cm-20um-40um-sl` |
| 7 | `32c-2s8mm6cm-20um-40um-dl.yml` | `32c-2s8mm6cm-20um-40um-dl` |
| 8 | `64c-3s6mm6cm-20um-40um-sl.yml` | `64c-3s6mm6cm-20um-40um-sl` |
| 9 | `64c-4s6mm6cm-20um-40um-dl.yml` | `64c-4s6mm6cm-20um-40um-dl` |
| 10 | `A1x32-6mm-50-177-H32_21mm.yml` | `A1x32-6mm-50-177-H32_21mm` |
| 11 | `NET-EBL-128ch-single-shank.yml` | `NET-EBL-128ch-single-shank` |
| 12 | `tetrode_12.5.yml` | `tetrode_12.5` |

> **App-catalog note:** the app's CLAUDE.md "Current Supported Device Types" lists
> `128c-4s8mm6cm-20um-40um-sl` and `128c-4s6mm6cm-15um-26um-sl` but **not** the four other 128-channel
> variants now present downstream (`-4s4mm6cm-15um-26um`, `-4s4mm6cm-20um-40um`, `-4s8mm6cm-15um-26um`,
> `-4s6mm6cm-20um-40um`). The app catalog should be widened to exactly these 12 to avoid false
> "unresolvable device_type" while still hard-blocking `screw`/`single_electrode`/typos. (Verify the
> app's `valueList.js deviceTypes()` + `ntrode/deviceTypes.js` against this list.)

---

## What trodes_to_nwb silently tolerates (the dangerous set — gate these in the app)

These convert "successfully" (or with a non-raising log) and write **wrong or missing** data:

1. **`power_in_W` verbatim Watts (#3)** — no range/sanity check on the excitation source power.
   `power_in_W: 200` → 200 W in the NWB. *App must gate: derive W from mW, or bound-check.*
2. **Out-of-range / under-range bad_channel (#17)** — index not in `0..N-1` silently never flags;
   the truly-bad channel ships as good. *App must validate bad_channels ⊂ probe indices.*
3. **Free-text `location` (#10, #11)** — any string (empty, `None`, typo, wrong case) is written
   verbatim → Spyglass BrainRegion fragmentation / "Unknown". *App must constrain location.*
4. **All subject vocabulary (#5, #6, #8, #9, #12, #16, #25)** — trodes validation **only logs** schema
   errors (`convert_yaml.py:59-61`, `logger.exception`, no raise), so `Rat`/`Male`/missing-DOB/`"541g"`/
   strain-as-genotype/placeholder-id all ship verbatim and are caught only at DANDI (very late) or in
   Spyglass. *This app is the real gate.*
5. **camera_id dangling on tasks (#15)** — task build does no camera-existence check.
6. **Same-animal static-fact drift (#7)** — no cross-day reconciliation exists; daily re-entry drift
   ships verbatim.
7. **`raw_data_to_volts` when the `.rec` lacks `rawScalingToUv` (#20)** — placeholder `1`/`0` gives
   wrong µV scaling silently. (Usually the header wins, so usually inert — but not guaranteed.)
8. **MMDDYYYY date sort mis-order (#24)** — `int(date)` parses and sorts wrong without raising.

**Net priority impact vs the synthesis:**
- **Power (#3)** — confirmed silent corruption → **keep top priority.**
- **Volume (#2)** — **downgraded**: converter reads the correct `volume_in_uL`; no NWB corruption.
  Still worth a one-input-derives-both UX so the dead lowercase key can't *look* authoritative, but it
  is no longer a data-corruption gate.
- **Space-keys (#1)** — **downgraded from silent to loud** on the current converter (KeyError in a
  normal ephys run). Still must be gated (the app owns key spelling anyway, and a behavior-only run
  would silently lose electrodes), but the "irreversible invisible corruption" framing no longer holds
  on current HEAD.
- **`1.5cd` (#13)** — **downgraded**: not consumed downstream at all; only an (ignored) schema log.
  An export-time numeric type-check still closes it cheaply.
- **bad_channel out-of-range (#17)**, **location (#10/#11)**, **subject vocab (#5/#6/#8/#9)**,
  **camera_id (#15)** — all confirmed silent → **keep/raise priority; the app is the only gate.**

---

*Cross-refs: `03-synthesis.md` §7 (the open-question falsifiers this answers — #1 volume/power read,
#2 opto all-or-nothing via `add_optogenetics` necessary-metadata check at `convert_optogenetics.py:49-60`,
#4 task_epochs coercion, #5 space-key read). Converter HEAD `65ec81a`. ndx units confirmed from the
installed `ndx-ophys-devices` spec, not assumed.*
