# Post-v3.0.0 follow-ups

Deferred work tracked out of the (since-removed) v3-workspace-cutover plan: UX niceties,
behavior-preserving tech-debt refactors with no correctness/a11y risk, the a11y gaps surfaced by the
dialog-on-`<Modal>` migration, and one release-gated data-migration item. None of these blocked the
v3.0.0 cutover; they **outlive** it — kept here so they aren't lost now that the plan's numbered phases
are done. File/line references below point at the live source.

## Tech-debt / UX niceties

1. **Make `ConfigurationSnapshot.appliedToDays` a derived value.** Today it is a denormalized cache kept
   in sync by `applyConfigurationForward` ([src/state/useWorkspace.js](../src/state/useWorkspace.js));
   the trustworthy view already exists as `reconcileAppliedToDays` ([src/state/configDiff.js](../src/state/configDiff.js)),
   and `updateDay({ configurationVersion })` bypasses the stored lists. Dropping the stored field and
   always deriving it removes the partition-maintenance burden. A data-model change — behavior-preserving
   but touches persisted shape, so coordinate with the persistence-migration item (#6).

2. **Reconfig wizard UX for long studies.** In [ReconfigWizard.jsx](../src/pages/DayEditor/ReconfigWizard.jsx),
   add select-all / deselect-all controls and relative or human-readable day labels for animals with
   60–200+ days, plus an explicit success confirmation after apply-forward.

3. **`Alt+←` / `Alt+→` shortcut chord vs. browser Back/Forward** on Windows/Linux. The handler
   `preventDefault`s ([src/hooks/useGlobalShortcuts.js](../src/hooks/useGlobalShortcuts.js)), so
   in-app it drives the stepper instead of navigating history. Consider `Alt+PageUp/PageDown` or
   `Alt+Shift+Arrow`, or add a platform note in the shortcuts help. Revisit with user feedback rather
   than pre-emptively.

4. **Persisted-"Validated" indicator** in the Validation Summary table
   ([src/pages/ValidationSummary/index.jsx](../src/pages/ValidationSummary/index.jsx)) — visually
   distinguish a day whose `state.validated` is persisted from one that is merely live-valid. Partly
   redundant once the AnimalWorkspace per-day chips consume the same flag.

5. **Structured error logging** for export skips/failures. The Validation Summary batch export currently
   logs via `console.error`; route these through a real logging path (error IDs / Sentry-style) once such
   infrastructure exists. Cross-app concern, not specific to one page.

## Surfaced by the pre-cutover dialog migration (reviewer findings, out of that scope)

These are pre-existing issues that the dialog-on-`<Modal>` migration made more visible (a
focus-trapped modal raises the stakes of keyboard/AT gaps in the enclosed content). They were
out of scope for the cleanup pass and are tracked here.

7. **CalendarDay grid is keyboard-unreachable when viewing a non-current month.**
   [CalendarDay.jsx](../src/components/CalendarDayCreator/CalendarDay.jsx) uses
   `tabIndex={isToday ? 0 : -1}`, so once the user navigates to a month that does not contain
   "today", every day cell has `tabIndex=-1` and Tab skips the whole grid — and now that the
   calendar is a focus-trapped modal, a keyboard-only user cannot select an off-month date at all
   (only ESC/nav/action buttons are reachable). Implement a proper roving tabindex that defaults to
   the first selectable cell of the displayed month when today is absent.

8. **CalendarGrid presents all 42 day cells as a single `role="row"`.**
   [CalendarGrid.jsx](../src/components/CalendarDayCreator/CalendarGrid.jsx) wraps the 42
   cells in one row under `role="grid"`; AT grid-navigation announces one row of 42 columns instead
   of 6 weeks × 7 days. Split into one `role="row"` per week (chunks of 7).

9. ~~**ChannelMapEditor empty-state instruction is a dead end.**~~ **RESOLVED** — the manual
   channel-maps editor (and its tab/route/nav entry) was removed entirely: no one used it and channel
   maps are generated automatically when an electrode group is saved with a device type. The
   electrode-groups surface now carries a read-only reassurance ("Channel maps are generated
   automatically from each electrode group's device type"), and ntrode validation issues route to the
   electrode-groups tab. The dead-end empty-state copy is gone with the component.

10. **`addConfigurationSnapshot` return value diverges from the assigned version on multiple adds
    within one render tick.** The returned version derives from `workspaceRef.current` (authoritative
    *now*), while the in-updater assignment uses `prev.length + 1`; for a single create-then-apply per
    tick (the only caller, the reconfig wizard) they agree, but two adds in the same tick would both
    return the same number while assigning sequential ones. Not reachable today; revisit if another
    caller batches snapshot creation. See
    [useWorkspace.js](../src/state/useWorkspace.js) `addConfigurationSnapshot`.

## Release-gated

6. **Persistence-blob forward migration.** ✅ **RESOLVED.** A versioned forward-migration
   framework now lives in `src/state/workspaceMigrations.js`: an ordered registry of pure migrators
   (`n: vN → vN+1`) and `migrateWorkspace`, which `loadWorkspace` runs (before device-normalize /
   shape-ensure) to upgrade an old blob forward instead of discarding it. Today's v1→v2 behavior is
   encoded as the first registered migrator; `MIGRATABLE_SCHEMA_VERSIONS` is derived from the
   registry. The mechanism is in place with no shape change yet — the first real shape change (the
   task catalog; the `appliedToDays` derivation) registers its `vN→vN+1` migrator + a `vN` fixture.
   Rule: bump `WORKSPACE_SCHEMA_VERSION` only together with a registered migrator and a fixture test.

## From the pre-cutover UX audits (audit docs since removed)

The Phase 10/11 pre-cutover audits were removed after their findings shipped in the Phase 11 polish
merge (`2677482` and its predecessors). Cross-checked against that merge, these items had **no matching
fix commit** and may still be open — verify against current code before actioning (the audits' F-04 /
F-10 / F-11 / T8-2 / mobile-overflow items were closed there and are NOT repeated here):

- **Human-readable `device_type` summaries (polish).** The probe identifiers in the electrode
  device-type selector are opaque (e.g. `128c-4s8mm6cm-20um-40um-sl`). Add a human summary to the
  options in [valueList.deviceTypes](../src/valueList.js) — carefully: the option *values* must stay
  selector-stable (they key into the trodes_to_nwb probe-metadata filenames).
- **Empty-state heading levels (polish).** A few empty-state headings still vary across the AnimalView
  setup tabs; normalize the levels for consistent document structure.

Design/future questions captured by the (removed) Phase-8.7 ownership spec — still unbuilt:

- **Versioned data-acq ("approach B").** If a mid-study amplifier swap must be representable per-day
  rather than flagged unsupported, the recording system needs per-day versioned snapshots — its own
  export-affecting phase. Related to the dataset-tier question in
  [scope-tiers-ia](../.claude/docs/plans/scope-tiers-ia/design-note.md).
- **Richer batch-triage diff view.** Whether `#/validation` batch triage needs a comparison/diff view
  beyond the row-scan contract (date/session, config version, cameras/calibration, opto, validation,
  export eligibility, next action). Revisit with user feedback.
