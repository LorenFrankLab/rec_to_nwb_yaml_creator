# Post-v3.0.0 follow-ups

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Items intentionally **not blocking the v3.0.0 cutover** ([Phase 11](phase-11-cutover-v3.md)): UX
niceties, behavior-preserving tech-debt refactors with no correctness/a11y risk, and one release-gated
data-migration item. The pre-cutover work that *does* need to land first lives in
[Phase 10.5](phase-10.5-pre-cutover-cleanup.md); anything here can ship after v3.0.0.

Track these so they aren't lost once the plan's numbered phases are done.

## Tech-debt / UX niceties

1. **Make `ConfigurationSnapshot.appliedToDays` a derived value.** Today it is a denormalized cache kept
   in sync by `applyConfigurationForward` ([src/state/useWorkspace.js](../../../../src/state/useWorkspace.js));
   the trustworthy view already exists as `reconcileAppliedToDays` ([src/state/configDiff.js](../../../../src/state/configDiff.js)),
   and `updateDay({ configurationVersion })` bypasses the stored lists. Dropping the stored field and
   always deriving it removes the partition-maintenance burden. A data-model change — behavior-preserving
   but touches persisted shape, so coordinate with the persistence-migration item (#6).

2. **Reconfig wizard UX for long studies.** In [ReconfigWizard.jsx](../../../../src/pages/DayEditor/ReconfigWizard.jsx),
   add select-all / deselect-all controls and relative or human-readable day labels for animals with
   60–200+ days, plus an explicit success confirmation after apply-forward.

3. **`Alt+←` / `Alt+→` shortcut chord vs. browser Back/Forward** on Windows/Linux. The handler
   `preventDefault`s ([src/hooks/useGlobalShortcuts.js](../../../../src/hooks/useGlobalShortcuts.js)), so
   in-app it drives the stepper instead of navigating history. Consider `Alt+PageUp/PageDown` or
   `Alt+Shift+Arrow`, or add a platform note in the shortcuts help. Revisit with user feedback rather
   than pre-emptively.

4. **Persisted-"Validated" indicator** in the Validation Summary table
   ([src/pages/ValidationSummary/index.jsx](../../../../src/pages/ValidationSummary/index.jsx)) — visually
   distinguish a day whose `state.validated` is persisted from one that is merely live-valid. Partly
   redundant once the AnimalWorkspace per-day chips consume the same flag.

5. **Structured error logging** for export skips/failures. The Validation Summary batch export currently
   logs via `console.error`; route these through a real logging path (error IDs / Sentry-style) once such
   infrastructure exists. Cross-app concern, not specific to one page.

## Release-gated

6. **Persistence-blob forward migration.** [Phase 1](phase-1-persistence.md) versions the localStorage
   blob and *discards with a notice* on `schemaVersion` mismatch — no migration. Acceptable for v3.0.0
   (no real v1 blobs exist yet), but once users have v1 blobs a future shape change would silently
   discard their saved work. Schedule a forward-migration path (transform old blobs forward instead of
   discarding) **before the first post-v3.0.0 change that touches the persisted shape** — including
   tech-debt item #1 above, which changes that shape.
