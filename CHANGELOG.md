# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Behavioral-events (DIO) editor is now the ECU hardware channel grid.** The Day Editor
  presents every digital channel of the SpikeGadgets ECU — **Inputs `Din1–32`** and
  **Outputs `Dout1–32`** (the board's real range, verified against Trodes `.trodesconf`) —
  and you type the event name for the channels your rig uses on this day. Which channel
  carries which event is a per-experiment wiring choice, so there is no baked-in preset; the
  grid just mirrors the hardware. **A blank channel is unused and is excluded from the
  exported YAML** (the schema requires a non-empty name). **Event names must be unique** — a
  duplicate is flagged inline and blocks export (it would collide on the Spyglass
  `DIOEvents` primary key). A new day carries the previous day's names forward, so you fill
  the grid in once per experiment and edit only on a rewire. An imported event whose channel
  isn't a standard `Din`/`Dout` line is preserved in an **"Other"** group rather than
  dropped. The exported YAML shape (`behavioral_events: [{ description, name }]`, named
  events only) is unchanged.
- **Per-label auto-numbering when picking a behavioral-event name.** Picking a known name
  from a channel's suggestions appends the next per-label instance number — picking *Poke*
  with no pokes yet yields `Poke1`, the next `Poke2`, and *Light* is counted independently
  (`Light1`). The number uses the no-separator `Label<n>` convention (verified against real
  lab YAMLs) and is a **per-label instance count, not the DIO channel index** (a pump on
  `Dout7` is still `Pump1`). **Typing a name stays verbatim** — free text (e.g. `beam_break`)
  is never auto-numbered. A numbered variant the app itself generates (`Poke1`, `Light1`, …)
  is recognized as a standard name, so it does not trip the "not a standard event name"
  nudge — that fires only for genuinely off-list custom names.

### Removed

- **Retired the animal-level behavioral-events (DIO) library.** Behavioral events are
  now a single **day-owned** set (the only ones exported); the animal-level "library"
  authoring surface (the **DIO** tab in the Animal view) and the Day Editor's "Use on
  this day" inherited-copy path are removed, ending the confusing animal-vs-day split.
  Existing days keep their own events (no exported data is lost — export already reads
  `day.behavioral_events`). `animal.behavioral_events` is retained-but-unused (vestigial)
  in the persisted blob for compatibility; no workspace schema version bump. An old
  `#/animal/:id/dio` URL resolves to the animal's default tab. The exported YAML shape
  is unchanged.

### Fixed

- **Recording days now stay date-ordered (F2).** `createDay` and `duplicateDay`
  previously appended to the stored `animal.days` index without sorting, so a day
  added or duplicated out of chronological order left the index unordered. The
  stored array is now canonically sorted by `date` (ascending, ISO `YYYY-MM-DD`)
  on write, so every reader sees days in chronological order. The exported YAML is
  unchanged.
- **DIO `description` types restricted to the valid digital I/O lines (`Din`/`Dout`).**
  The Type dropdown previously also offered `Accel`/`Gyro`/`Mag`, but those are
  **analog** IMU channels, not digital I/O — a DIO `description` is looked up against
  the `.rec` `ECU_digital` stream during conversion (trodes_to_nwb
  `get_digitalsignal("ECU_digital", …)`), so an analog value would fail that lookup.
  An existing analog `description` no longer crashes the editor: the Type control
  degrades gracefully to `Din` while preserving the parsed line index. The exported
  YAML shape is unchanged. Note: in the legacy single-page form, opening an imported
  event whose `description` is analog (e.g. `Accel2`) and blurring the field rewrites
  it to its `Din`/`Dout` fallback (`Din2`), because that form's control is
  uncontrolled and falls back to the first valid option when the stored one is gone.
- **New behavioral events no longer save an empty `description`.** A freshly-added
  event is now seeded to the default DIO line (`Din1`) so the stored value matches
  what the guided Type/Index controls display. Previously the controls showed
  `Din`/`1` for a new event while the model held an empty string, so saving without
  touching them persisted an empty `description` (which fails the downstream
  `ECU_digital` lookup).

### Changed

- **Behavioral-event name suggestion `Run Camera Ticks` → `Run_Camera_Ticks`.** The
  suggestion now matches the spelling used in 98/98 recorded corpus files (underscores), so
  the suggested name is the one labs actually use and the standard-set template's
  camera-ticks row is recognized as a standard name. Free text is unaffected; the exported
  YAML shape is unchanged. (The non-validating `examples` array in `nwb_schema.json` still
  lists the spaced form — it is co-owned with trodes_to_nwb and is left for a coordinated
  cross-repo change.)
- **Restored guided DIO Type + line-index entry (F5).** The Behavioral Events /
  DIO library editor now enters a DIO event's `description` through a **Type**
  dropdown (`Din`/`Dout`) plus a numeric **DIO line index** control, instead of a
  single free-text box — recognition over recall, and it prevents a silently
  malformed DIO line name. The stored and exported `description` string is unchanged
  (e.g. `"Din1"`). When the stored `description` is a non-standard value the controls
  fall back from (an imported analog/prose string), an inline note now warns that
  editing the controls will rewrite it — making the fallback visible rather than
  silent.
- **Recording-day dates are validated as ISO `YYYY-MM-DD` on write.** `createDay`
  and `duplicateDay` now reject a non-ISO date, since the date-ordered index relies
  on `YYYY-MM-DD` sorting lexicographically as chronological (the date picker already
  enforces this; the guard covers programmatic callers).

### Added

- **Per-day behavioral-events (DIO) wiring table.** The recording-day editor now
  presents the day's behavioral events as a wiring table grouped into **Inputs
  (Din)** and **Outputs (Dout)** (plus an **Other** group for any imported
  non-standard channel), reading like the physical rig. Each row maps a hardware
  **DIO channel** (the `description`) to an **Event** (the `name`, which "becomes the
  DIO event's name in the NWB file"), edited via the guided Type/line-index controls.
  A text legend (Din = inputs, Dout = outputs), per-field hints, and an explainer
  ("edit only if you rewired the rig") accompany it; rows delete through the shared
  confirmation dialog. The animal's inherited library is still shown above as
  read-only reference. The exported YAML shape is unchanged.
- **Off-list combobox warning is now linked to its input** via `aria-describedby`
  (merged with any caller-provided value), so screen readers associate the
  standard-options nudge with the field.

- **Accessible suggestion combobox** (`SuggestionCombobox`). An editable combobox
  (WAI-ARIA "combobox with list autocomplete") that replaces the native
  `<datalist>`: opening it browses the **full** suggestion list even after a value
  is chosen (the datalist collapsed to the single match), typing filters, free
  entry is retained, and it supports keyboard navigation. An optional off-list
  nudge encourages standard values.
- **Behavioral-event name suggestions.** The event **Name** field is now this
  combobox, offering the catalog of common names (`Home box camera`, `Poke`,
  `Light`, `Pump`, `Run Camera Ticks`, `Sleep`) and warning when a non-standard
  name is entered. Free entry is retained; the stored value is unchanged.
- **Off-list warning for brain regions.** The brain-region autocomplete
  (`BrainRegionAutocomplete`, used in the Electrode Group editor) now uses the same
  combobox and warns when a region is not one of the standard options — reinforcing
  the existing CA1-vs-ca1 canonicalization that keeps Spyglass queries consistent.
