# DIO behavioral-events: per-day sets, real-world UX, and a naming correction

**Status:** Not started. _(Revised three times: independent source-verification review (§11), design answers on UX, and an app-pattern consistency pass (§6).)_

A mini plan. Reframe the app's behavioral-events (DIO) handling to match how DIOs actually work in
Trodes / trodes_to_nwb / Spyglass and how the lab really records them: a **per-day set** mapping
hardware channels to semantic event labels, **carried forward** day-to-day and edited only on a
rewire. Also corrects a recently-shipped naming convention that the hardware + real data prove is
backwards.

This is a design+roadmap doc, not full phase files. Expand a phase into its own file when it's picked
up for execution.

---

## 1. Why

The current model treats DIO events as an **animal-level library of individual events**
(`animal.behavioral_events`, templates) that each day assembles from via "Use on this day". That
decomposition fights the reality below, and the field labels (`name` / `description`) expose schema
keys that are unintuitive and even **inverted vs NWB**, so users can't tell what to enter where.

A recent commit (`057d04c`) also ties an event's name-number to its DIO **channel index** — the exact
opposite of what the hardware and real data do.

## 2. Verified ground truth (the anchor — independently re-verified; do not re-litigate without re-checking these sources)

**Trodes hardware** (`/Users/edeno/Documents/GitHub/trodes`, `.trodesconf`, e.g.
`Resources/SampleWorkspaces/128_Tetrodes_ECU_Sensors.trodesconf`):

- The ECU exposes a **fixed** set of digital channels `Din1…DinN` / `Dout1…DoutN`
  (`<Channel dataType="digital" id="Din1" input="1" …>`; `Dout` are `input="0"`), each a hardware bit.
  Channel IDs are **hardware-fixed, not user-chosen**.
- `Accel`/`Gyro`/`Mag` are `dataType="analog"` IMU sensors (`AccelX/Y/Z`, …) — **NOT** digital I/O.
- The conf also defines `MCU_Din1…6` / `MCU_Aux` digital lines, but trodes_to_nwb hardcodes the
  `ECU_digital` stream (below), so **MCU lines are never consumed — out of scope by design.**
- Trodes stores **no semantic labels** (no `Poke`/`Well` naming in FSGui). `Poke1` exists **only** in
  the metadata YAML.
- Semantics worth teaching: **`Din` = inputs** (sensors the animal triggers: pokes, beam breaks);
  **`Dout` = outputs** (things you drive: lights, pumps, opto).

**trodes_to_nwb** (`/Users/edeno/Documents/GitHub/trodes_to_nwb/src/trodes_to_nwb/convert_dios.py`,
one DIO set per session/`.rec`):

- `description` is looked up against the `.rec` `ECU_digital` stream (`stream_name = "ECU_digital"`
  `:72`; `get_digitalsignal(..., prefix + channel_name)` `:85`) — it **must be a real ECU digital
  channel** _for export to succeed_. Duplicate `description` → `ValueError` (`:29-30`).
- `name` → `TimeSeries.name`; `description` → `TimeSeries.description` (the NWB inversion, `:97-105`).
- Optional `comments` third field (`:33`).
- One YAML per `(date, animal)` session (`convert.py:279`; `:331-334` raises if not exactly one) → DIO
  config is **inherently per recording day**, reconfigurable between days, independent between animals.

**Spyglass** (`/Users/edeno/Documents/GitHub/spyglass/src/spyglass/common/common_dio.py:18-26`):

- `DIOEvents` PK = `(Session→Nwbfile.nwb_file_name, dio_event_name)` → **`name` is unique per session /
  day**, not per-animal, not global. Names freely repeat across days/animals.

**Real data** (98 YAMLs, **4 distinct subjects** — the `Re _metadata_round_2-` folder is a **chimi**
re-run, not a 5th rat — `~/Downloads/all_rat_metadata_yaml`):

- Sets are 19–21 events and **near-constant across days**: chimi 30 days = 1 identical set; peanut and
  wilbur likewise; only **senor** reconfigured (3 sets / 26 days).
- Naming is `Label<digits>`, the number appended with **no separator** (`Poke1…Poke6`, `Light1…Light6`,
  `Pump1…Pump6`); single events unnumbered (`Run_Camera_Ticks`). Underscores _do_ occur inside
  multi-word labels and run-suffixes — the load-bearing fact is the separator _before the number_:
  **0 of 1864 names match `Label_<digits>`; 1762 match `Label<digits>`.**
- The number is a **semantic per-label instance, NOT the channel** (`Pump1 = Dout7`; ~39% of names have
  number ≠ channel number). Across a reconfiguration the **semantic identity is preserved**: senor's
  `Poke3` is `Din3` before and `Din18` after the rewire — it did **not** become `Poke18` (exactly what
  `057d04c`'s reactive-follow would have produced — so senor _strengthens_ the revert).
- **But a rewire is not just "re-point a channel."** On senor's actual transition day (`20201110`),
  `Poke3` was **split + renamed** into `Poke3_r1→Din3` (old line) and `Poke3_r2-6→Din18` (new line) to
  capture a within-session rewire, before settling to `Poke3→Din18` the next day. So reconfiguration in
  practice = **edit the set freely: re-point a channel, rename, and/or add/remove events.**

## 3. Decisions

1. **Model: a DIO set is day-owned and carries forward** — the **bad-channels pattern** (§6), not the
   camera catalog+subset pattern. A new day inherits the **prior day's** set; `createDayRecord` already
   deep-copies `day.behavioral_events` when a carry source exists
   (`src/state/workspaceTransitions.js:389`); the first day of an animal seeds `[]`. Editing is the
   steady state; a rewire is an edit that carries forward — re-point / rename / **add** / remove.
2. **`name` = the (user-owned) semantic identity; `description` = the constrained hardware channel.** The
   name is **never derived from / never auto-follows** the channel — the user may rename deliberately
   (senor). Keep them decoupled.
3. **`description` is constrained to `Din`/`Dout` + number** in the authoring UI. Drop
   `Accel`/`Gyro`/`Mag` from the type list. (Import still round-trips any string — §9 N1.)
4. **Auto-numbering, if offered, is per-label instance count** (`Poke1`, `Poke2`, …), no underscore,
   never derived from / following the channel.
5. **Reconfiguration is a free, full edit of the set** — re-point / rename / **add** / remove (the senor
   day _added_ `Poke3_r1`/`Poke3_r2-6`). No special mechanism: the carried-forward set is fully
   editable; an optional **"Mark reconfiguration"** action just tags the change in a **passive history
   log** ("just edit; history is nice").
6. **Drop the animal-level behavioral-events library** as an authoring surface (§6 rationale: a day uses
   the FULL set and edits its CONTENT per-day → bad-channels-shaped, not camera-shaped). One source of
   truth = the day's set. Removes the confusing animal-vs-day split.
7. **First-day / new-animal bootstrap (replacing the library) reuses existing patterns:** carry-forward
   within an animal; **shared standard-set templates** ("add 6 pokes on Din1–6" → `Poke1…Poke6`) for a
   blank first day; and **`CopyFromAnimalDialog`** — add `behavioral_events` as a copyable section
   (today it copies electrode groups / cameras / recording-system; DIO is a gap, §6).
8. **UX: present the set as a wiring table in the user's language**, not `name`/`description` fields,
   following the app's section conventions (§6).
9. **Group the table by direction — a visible "Inputs (Din)" section and "Outputs (Dout)" section.**
10. **Explain fields with inline per-field hints + a one-time text legend** (`Din`=input / `Dout`=output).
    **No literal ECU hardware diagram** (no reliable asset; counts vary by model; the table _is_ the
    diagram). **No separate live-preview panel** — close the NWB `name`/`description` inversion with a
    one-line hint on the Event field ("becomes the DIO event's name in the NWB file").

## 4. What's wrong in the current code

- **`057d04c` is backwards — revert it surgically** (keep the one good primitive):
  - Remove `buildEventName` (`_`+channel-index) and the reactive `followDioIndexInName` from
    `src/pages/AnimalEditor/BehavioralEventsSection.jsx`, plus their tests in
    `src/pages/AnimalEditor/__tests__/BehavioralEventsSection.test.jsx`.
  - **Keep** the `SuggestionCombobox` `onSelect` hook (`src/components/SuggestionCombobox.jsx`) and its
    tests — a generic pick-vs-type primitive we'll reuse for correct per-label numbering.
  - Update `CHANGELOG.md` (the `057d04c` entry).
- **DIO type list is wrong:** `behavioralEventsDescription()` (`src/valueList.js:923`) returns
  `['Din','Dout','Accel','Gyro','Mag']`. Only `Din`/`Dout` are valid; `Accel`/`Gyro`/`Mag` are analog
  and would fail `get_digitalsignal("ECU_digital", …)`. `splitDioDescription`
  (`src/utils/dioDescription.js`) recognizes a Type from this **same** list, so trimming it also changes
  how a stored analog description parses (§9 S3 — real-data impact: zero).

## 5. UX design (the heart)

Stop exposing schema keys; mirror the user's rig. The moves:

1. **Relabel:** `description` → **"DIO channel"**; `name` → **"Event"**. YAML keys unchanged.
2. **Group by direction with a one-time legend** — render an **"Inputs (Din)"** block and an
   **"Outputs (Dout)"** block (§3.9).
3. **Wiring-table layout** (per day), reading like the physical setup, with a section explainer stating
   what the whole thing corresponds to and the carry-forward status:

   ```text
   Behavioral events — how your behavioral hardware maps to the SpikeGadgets ECU
   (carried forward from 2020-11-09 · edit only if you rewired the rig)

   Inputs (Din) — sensors the animal triggers
     DIO channel     Event            Notes (optional)
     [Din ▾] [ 1]    Poke1            left well poke
   Outputs (Dout) — things you drive
     [Dout▾] [ 7]    Pump1            reward pump

   [+ add event]   [+ add a standard set ▾]      [Mark reconfiguration…]
   ```

   Per-field hints with real examples; the **Event** hint notes it "becomes the DIO event's name in the
   NWB file" (closes the inversion — not a preview panel, §3.10).
   **a11y:** Type/index controls need explicit `aria-label`s (reuse "DIO type"/"DIO line index"); the
   Din/Dout legend must be _programmatically associated_; don't rely on an emoji glyph for meaning.
4. **Lean on standard + stable sets:** default view = "review yesterday's set"; **templates / bulk-add**
   produce canonical `Poke1…Poke6`; **reconfiguration is a full edit** optionally tagged via "Mark
   reconfiguration" into a passive history.

Follow the section conventions in §6 so the new table looks native.

## 6. Consistency with the rest of the app

**Adopt the bad-channels precedent; reject the camera precedent.** The app has two relevant ownership
patterns (mapped with evidence):

- **Camera "animal catalog + per-day reference":** `animal.cameras` is the source of truth; a day
  references a SUBSET by id (`day.cameras_used`, **not** carried forward — `workspaceTransitions.js:319`)
  and editing a camera's content is an animal-level edit with cross-day blast radius
  (`cameraUsage.js:130`). Recording systems (`data_acq_device_name`) and the _planned_ task-type catalog
  (C3, `design-feedback-remediation/shared-contracts.md`) follow this. **Wrong fit for DIO:** days use
  the FULL set, not a subset, and the set's CONTENT changes per-day.
- **Bad-channels "day-owned + carry-forward":** stored at `day.deviceOverrides.bad_channels`, a new day
  is seeded from the prior day's full set (`createDayRecord`, `workspaceTransitions.js:362-369`), then
  edited in place; config-version boundary resets on reconfiguration
  (`badChannelMonotonicity.js`). **This is DIO's shape** — and `createDayRecord` _already_ carries
  `day.behavioral_events` forward (`:389`), so the core primitive exists.

**Bootstrap precedent (§3.7):** `CopyFromAnimalDialog.jsx:54` already copies electrode groups (+ maps),
cameras, and recording-system from an existing animal (re-IDs electrode groups `:221-251`; only seeds an
EMPTY target section). **`behavioral_events` is NOT in its `ALL_SECTIONS` (`:26`) — add it.**

**UI/section conventions the wiring table must mirror** (representative: `CamerasSection.jsx`,
`TasksTable.jsx`):

- Shape: `div.{name}-section` → `header.section-header` (`<h2>` + explanatory `<p>`) → `div.table-actions`
  with a `button-primary` → `role="table"` (`CamerasSection.jsx:153-168`).
- Empty state block (icon + `<h3>` + copy + hint + primary CTA) (`CamerasSection.jsx:133-148`).
- Status badges: glyph + `aria-label`/sr-only text, **never color/emoji alone** (WCAG 1.4.1)
  (`TasksTable.jsx:216-223`).
- Inline validation: `div.inline-error[role=alert]` / `div.inline-warning[role=status]`, with
  `aria-invalid` and `aria-describedby` (`BehavioralEventsSection.jsx:341-350`).
- Delete via shared `ConfirmDialog` (no `window.confirm`), naming affected dependencies
  (`TasksTable.jsx:124-144`).
- Reuse the **existing guided Type/Index controls** (`BehavioralEventsSection.jsx:352-391`, already
  `aria-label`led + `SuggestionCombobox`) — **move them down** to the day table, don't rebuild.

**Gates share one helper (keep it that way):** name uniqueness Rule 14 (`rulesValidation.js:712`) and
duplicate-`description` (`:1022` via `src/validation/behavioralEvents.js`) — the latter is already
surfaced inline by the SAME helper in `BehavioralEventsDisplay.jsx:48`. The redesign keeps the inline
gate and the export gate sharing that helper.

**Export key order:** `BEHAVIORAL_EVENT_ORDER = ['description','name']` (`workspaceUtils.js:47`);
`reorderKeys` is lossless (`:94-104`) and `comments` round-trips byte-identically — never leak an
internal field onto an exported event row (golden baselines gate it).

**Migration-framework dependency (real):** there is **no `workspaceMigrations.js` yet** — load-time
migration is an inline shape-ensure (`persistence.js:122-140`; `WORKSPACE_SCHEMA_VERSION = 2`). Dropping
the library _cleanly_ (relocating/removing `animal.behavioral_events`) needs a registered migrator +
version bump — the SAME framework the planned task-catalog (C2) needs. **Coordinate, or scope Phase 2 to
leave `animal.behavioral_events` vestigial** (export already reads `day.behavioral_events`, so no export
change is required to stop _showing_ the library — see §9).

## 7. Phase outline (expand to phase files at execution)

- **Phase 1 — Naming correction + type fix (small, ships first; review-verified baseline-safe).** Revert
  `057d04c` surgically (keep `onSelect`); restrict DIO types to `Din`/`Dout`; CHANGELOG. Baselines stay
  byte-identical (touches AnimalEditor + valueList only).
- **Phase 2 — Day-level wiring table; retire the animal library (net-new UI, not a relabel).** Build the
  per-day `BehavioralEventsDisplay` as the Inputs/Outputs wiring table; **move** the Type/index controls
  down (don't rebuild); relabel, add legend + per-field hints + a11y; carry-forward "review yesterday's
  set" default. Remove the library authoring surface; handle its data per §9 (vestigial vs migrated).
  Add `behavioral_events` to `CopyFromAnimalDialog`.
- **Phase 3 — Standard-set templates + per-label auto-numbering.** Bulk-add canonical sets; correct
  auto-number = per-label instance count via `onSelect`.
- **Phase 4 (optional) — Reconfiguration as a named action (re-point / rename / add / remove) + passive
  history; expose the existing `comments` field.**

Each phase: ship as one PR, dispatch `code-reviewer` against the diff, keep golden baselines
byte-identical, write its CHANGELOG entry in the same PR.

## 8. Open questions

_None blocking._ Resolved: bad-channels day-owned model (§3.1/§6); drop the animal library with
templates + `CopyFromAnimalDialog` bootstrap (§3.6-3.7); Inputs/Outputs grouping; inline hints + text
legend, no hardware diagram; no live preview; reconfiguration = full edit. The only execution-time
judgment left (§9) is **whether Phase 2 leaves `animal.behavioral_events` vestigial or migrates it** —
decided by whether the migration framework is built in time (coordinate with the task-catalog C2).

## 9. Migration & edge cases (address in the phase that touches each)

- **Animal-library retirement (S2/S3).** Existing days already OWN their `behavioral_events` (populated
  via "Use on this day"), so retiring the library loses **no exported data**. But an animal may hold
  library events never applied to a day — do **not** silently drop them. Two acceptable paths: (a)
  **vestigial** — stop showing/writing the library, leave `animal.behavioral_events` in the blob
  (no migrator needed; export already day-owned); or (b) **migrate** — register a migrator (needs the
  §6 framework) that seeds an animal's empty first day from its library, then removes the field.
  Default to (a) unless the framework is ready.
- **S3 — existing analog descriptions.** Phase 1 removes `Accel`/`Gyro`/`Mag` from the type list;
  `splitDioDescription` keys off that list, so a stored analog description renders as an unrecognized
  type. Real-data impact = **zero**; still, don't crash — show the raw value.
- **N1 — import/author asymmetry.** Imported YAMLs may carry **prose** `description`s (golden
  `realistic-session.yml:225-230`). Restricting the dropdown to `Din`/`Dout` while still importing
  arbitrary strings is intentional — surface it; don't silently coerce on import.
- **S4 — `comments` already round-trips** (lossless `reorderKeys`; in a golden fixture). Exposing a
  comments field won't break baselines — no redundant export plumbing.

## 10. Deliberately not in this plan

- Changing the **exported YAML shape** — `behavioral_events: [{ description, name, comments? }]` stays;
  golden baselines stay byte-identical.
- A heavy **versioned DIO-config** entity (electrode-group style). Carry-forward + passive history is
  the chosen weight; revisit only if users ask for explicit pinning/audit.
- Validating `description` against a specific ECU channel count — depends on the rig's `.rec`; emit
  well-formed `Din`/`Dout<n>` and let trodes_to_nwb match. **MCU** lines are out of scope.
- **Correcting the `nwb_schema.json` `description` `examples` array.** It still lists
  `Accel`/`Gyro`/`Mag` (`behavioral_events/items/description`, ~`:924-930`), now contradicting the
  authoring type list. It is a **non-validating** JSON-Schema `examples` array (the only constraint
  is `type: string` + a non-empty `pattern`), so leaving it has **zero** validation / data impact —
  Phase 1 deliberately did not touch it. But the schema is **co-owned with trodes_to_nwb** (CLAUDE.md:
  schema changes must be coordinated across both repos) and gated by the schema-version CI, so trim
  it in a **coordinated cross-repo change**, not a unilateral edit here.

## 11. Review log

An independent source-verification agent re-checked every load-bearing claim against trodes_to_nwb, the
`.trodesconf`, spyglass, and the 98 real YAMLs (corrections: senor split/rename/add example, "4
subjects", naming-separator stats, `convert_dios.py` line refs, net-new scoping for Phases 2–4, §9
migration). A design pass folded in: Inputs/Outputs grouping, inline hints + text legend (no hardware
diagram), no live-preview panel, reconfiguration as a full edit. An app-pattern consistency pass (§6)
confirmed DIO matches the **bad-channels day-owned + carry-forward** precedent (not the camera catalog
pattern), settled the library decision (drop it; bootstrap via templates + `CopyFromAnimalDialog`), and
pinned the section/UI conventions + the migration-framework dependency. Verdict: Phase 1 safe to ship as
written; Phases 2–4 execute against this text.
