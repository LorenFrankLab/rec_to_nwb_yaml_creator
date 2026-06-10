# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Recording days now stay date-ordered (F2).** `createDay` and `duplicateDay`
  previously appended to the stored `animal.days` index without sorting, so a day
  added or duplicated out of chronological order left the index unordered. The
  stored array is now canonically sorted by `date` (ascending, ISO `YYYY-MM-DD`)
  on write, so every reader sees days in chronological order. The exported YAML is
  unchanged.

### Changed

- **Restored guided DIO Type + line-index entry (F5).** The Behavioral Events /
  DIO library editor now enters a DIO event's `description` through a **Type**
  dropdown (`Din`/`Dout`/`Accel`/`Gyro`/`Mag`) plus a numeric **DIO line index**
  control, instead of a single free-text box — recognition over recall, and it
  prevents a silently malformed DIO line name. The stored and exported
  `description` string is unchanged (e.g. `"Din1"`).

### Added

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
- **Index-based name construction for DIO events.** Picking a name suggestion
  appends the DIO line index (`Poke` on `Din2` → `Poke_2`), and an auto-built name
  keeps its number in sync when the index changes — mirroring the lab convention
  (`Light_1`/`Din1`, `Light_2`/`Din2`) and keeping the Spyglass DIO event name (its
  primary key) unique without manual numbering. Free-typed names are left untouched.
- **Off-list warning for brain regions.** The brain-region autocomplete
  (`BrainRegionAutocomplete`, used in the Electrode Group editor) now uses the same
  combobox and warns when a region is not one of the standard options — reinforcing
  the existing CA1-vs-ca1 canonicalization that keeps Spyglass queries consistent.
