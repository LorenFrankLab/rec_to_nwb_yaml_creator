# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Design-token + CSS-Modules styling foundation.** Extended the `:root` token set in
  `src/index.css` with a grey-500, a radius scale (`--radius-sm/md`), a shadow scale
  (`--shadow-sm/--shadow-modal`), and a **z-index scale** (`--z-base` … `--z-skip-link`) that is now
  the single source of truth for stacking order. Stood up **CSS Modules** with one canonical,
  token-driven button primitive (`src/components/ui/Button`) replacing the divergent global
  `.button-*` color copies; migration of the rest is incremental. Added **stylelint**
  (`npm run lint:css`) enforcing tokens on `z-index`/`color`/`background-color` at warn-level. No
  change to the exported YAML.
- **Incremental TypeScript support (toolchain only; no runtime or export change).** `.ts`/`.tsx`
  now coexist with `.js`/`.jsx` (`tsconfig.json` with `allowJs`, `checkJs: false`, `strict`). A new
  `npm run typecheck` (`tsc --noEmit`) runs as its own CI job and is the **only** type-check — the
  Babel production build does not type-check. The pure YAML codec (`io/yaml`) and the workspace data
  model (`state/workspaceTypes`) are the first modules typed; the YAML codec's six exports are typed
  under `strict` with no logic change, and the golden baselines stay byte-identical. Linting,
  `lint-staged`, and the vitest transform were extended to handle `.ts`/`.tsx`.
- **Behavioral Events is now its own Day Editor tab.** The DIO channel grid moved out of the
  crowded **Tasks & Epochs** step into a dedicated **Behavioral Events** section in the day-editor
  nav (under "Recording"). It is optional — a day with no behavioral events badges as complete, not
  incomplete — and a duplicate name (Rule 14) or channel (Rule 17) now badges and routes its
  "Fix →" to this tab (as does the corrupt-shape reset control). Tasks & Epochs keeps the FsGUI
  DIO-output reference (which still reads the day's events). The exported YAML is unchanged.
- **Copy a behavioral-events (DIO) setup from another animal.** A blank first day (a new animal on
  the same rig) can reuse another animal's DIO mapping instead of re-keying it: when the day has no
  events and another animal has a set, the grid offers **"Copy from {animal} ({n} events)"**, which
  seeds this day from that animal's most-recent day (carry-forward then propagates it to later
  days). It reuses your own data — not a baked-in preset — and the CTA disappears once the day has
  events. The exported YAML is unchanged.

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

- **Removed the manual channel-maps editor (F1).** No one used it, and the exported
  `ntrode_electrode_group_channel_map` is generated automatically when an electrode group is saved
  with a device type — independently of any editor. The **Channel Maps** tab/route/nav entry and the
  editor (ChannelMapEditor / ChannelMapsStep / its container + CSV import-export) are gone. The
  electrode-groups surface now shows a read-only reassurance ("Channel maps are generated
  automatically from each electrode group's device type"), and channel-map (ntrode) validation issues
  route their "Fix" action to the **Electrode Groups** tab (the map's owner). Map auto-generation, the
  exported YAML, bad-channel marking, and the frozen legacy `ntrode/ChannelMap.jsx` are unchanged.
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

- **The workspace header is now a single app bar; the logo and keyboard-shortcuts trigger no longer
  collide with the navigation (F3).** The banner's desktop `position: fixed` pulled it out of flow, so
  the primary nav slid up underneath and the logo + shortcuts overlapped it. The workspace routes now
  render one app-bar row — logo (left), primary nav, keyboard-shortcuts trigger (right) — which at
  narrow widths drops the nav to its own row beneath the logo + shortcuts. The frozen legacy route
  keeps its original fixed banner with the logo + shortcuts grouped. The banner also carries
  `var(--z-banner)` from the new z-index scale as defense-in-depth. Browser-verified at desktop and
  narrow widths and guarded by an e2e spec.
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

- **Tasks & Epochs screen — clarity redesign (no data-model or export change).** The day editor's
  most-complex screen now opens with a plain-language framing that defines a *task* (one activity
  in one environment, with its cameras) and an *epoch* (a numbered time block of that task, each
  belonging to exactly one task). Decorative emoji are gone, and the glyph status badges (✓/⚠/❌)
  are replaced with token-colored **text labels** — the one badge that overloaded two problems is
  split into distinct "Needs epochs" and "Missing camera" labels (an error like a reused epoch or a
  missing required field reads as text, too). The optional, epoch-linked editors — associated
  videos, associated files, and FsGUI protocols — are now collapsed-by-default sections (each
  showing an item count), preceded by a one-line note that they reference a task's epochs and that
  editing or deleting a referenced task asks you to confirm before the link is cleared (so the
  repair dialog is expected, not a surprise). Add-button labels and section heading levels are
  normalized. `day.tasks` and the exported YAML are unchanged (golden baselines byte-identical), and
  the redesigned step has zero automated-accessibility (axe) violations.
- **Day Editor structural refactor (internal; no behavior or export change).** Extracted the day
  device-override merge — the override > snapshot resolution AND the matching "can this override
  be honored cleanly?" shape classification — into one pure module
  (`src/domain/deviceOverrideMerge.ts`) that both the export path (`resolveDayConfig`) and the
  validator (`dayOverrideIssues`) build on, so the two can no longer drift in how they read a day's
  `deviceOverrides`. Introduced a `DayEditorContext` so the day-editor sections read the shared
  per-day bundle (animal, day, merged metadata, the field-update writer, …) from context instead of
  having the same seven props drilled through every section. Golden baselines are byte-identical and
  the day-validation contract is unchanged.
- **Behavioral-event name suggestions are now direction-specific.** Verified against the
  98-file corpus, every recorded event splits cleanly by direction, so a **Din** (input)
  channel now suggests only `Poke` / `Run_Camera_Ticks` and a **Dout** (output) channel only
  `Light` / `Pump` — offering an output name on an input channel (or vice versa) implied a
  physically wrong wiring. The off-list nudge follows suit (a pump named on an input channel
  is flagged). Names that never appear in real data (`Home box camera`, `Sleep`) are no longer
  suggested; `Run Camera Ticks` → `Run_Camera_Ticks` matches the corpus spelling. Free text is
  unaffected and the exported YAML shape is unchanged. (The non-validating `examples` array in
  `nwb_schema.json` still lists the old forms — co-owned with trodes_to_nwb, left for a
  coordinated cross-repo change.)
- **Recording-day dates are validated as ISO `YYYY-MM-DD` on write.** `createDay`
  and `duplicateDay` now reject a non-ISO date, since the date-ordered index relies
  on `YYYY-MM-DD` sorting lexicographically as chronological (the date picker already
  enforces this; the guard covers programmatic callers).

### Added

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
  `Light`, `Pump`, `Run_Camera_Ticks`, `Sleep`) and warning when a non-standard
  name is entered. Free entry is retained; the stored value is unchanged.
- **Off-list warning for brain regions.** The brain-region autocomplete
  (`BrainRegionAutocomplete`, used in the Electrode Group editor) now uses the same
  combobox and warns when a region is not one of the standard options — reinforcing
  the existing CA1-vs-ca1 canonicalization that keeps Spyglass queries consistent.
