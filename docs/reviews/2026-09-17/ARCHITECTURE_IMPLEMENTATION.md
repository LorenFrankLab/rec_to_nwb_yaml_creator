# Architecture implementation report

Date: 2026-09-17. This report records the implementation of the [architecture fix plan](ARCHITECTURE_FIX_PLAN.md) for findings A1–A8 in the [architecture review](ARCHITECTURE_REFACTOR_REVIEW.md).

## Result

The data-entry path now has explicit contracts for edit acceptance, draft retention, atomic related writes, record identity, repair routing, URL state, and validation reuse. The changes address the demonstrated data-loss and dead-end mechanisms while preserving the compact daily-entry design:

- Routine daily work starts with weight and epochs. Recording details, inherited context, carry-forward policy, and calibration detail remain available through clearly named disclosures.
- Experimenters inherit from the animal and can be changed for a day without forcing repetitive entry.
- The app distinguishes a typed field draft, acceptance into the in-memory workspace, browser persistence, and export readiness.
- Save, navigation, writer handover, and export all consult the same draft-flush result. A rejected or unapplied draft cannot produce a false successful save or a download that omits displayed input.
- Files and videos have stable workspace-only identities. Reordering or editing neighboring rows no longer changes React identity, and the internal fields do not enter YAML.
- Day sections are represented in the URL. Reload, bookmarks, browser history, ordinary navigation, and repair links resolve through the same section adapter.
- Readiness and the day-editor view model share one merge/validation result for a workspace revision.

## Implemented contracts

| Plan group | Implemented behavior | Evidence |
| --- | --- | --- |
| 1. Typed editing | Explicit modern store/action/selector and commit-result types; legacy values are contained at the adapter. Leaf updates apply to the latest day through a guarded path transition. Related field changes can commit together. The workspace updater is evaluated once and published synchronously. | `commitResult.ts`, `workspaceActions.ts`, `workspaceTransitions.ts`, `useWorkspace.ts`, and `workspaceEditingContracts.test.ts`. |
| 2. Draft reliability | A draft clears only after an accepted commit. Rejected values and errors remain keyed by record and field across unmount/remount. Flush reports accepted, rejected, and unapplied work. Save status and export fail closed on unresolved drafts. | `draftRegistry.ts`, `useDraftField.ts`, persistence and export integration tests. |
| 3. Repair routing | Current Day Editor section and focus-path resolution now live in `repairRouting.ts`. Technical units route to Recording Setup before behavioral-event matching. Labels, deep links, and current sections use the shared resolver, including hidden files/videos and animal-scope handoff. | `repairRouting.currentSections.test.ts`, repair-navigation integration, and `workspace-parity-repairs.spec.js`. |
| 4. Atomic related writes | Multi-field day changes use one transition. Task-catalog and day assignments commit together after ownership validation. Epoch renumber/delete changes update task instances, files, videos, FsGUI protocols, stimulation protocols, and related day state as one accepted write. | `updateTaskCatalogAndDayFields`, `onFieldsUpdate`, EpochsTab tests, and workspace transition tests. |
| 5. Stable identity | Workspace schema v5 assigns deterministic stable IDs to file/video records and freezes inferred file kind. Editors use IDs as keys and draft ownership. Export removes internal ID/kind fields and retains the previous YAML bytes. | v4→v5 migration fixture/tests, associated-record helpers, file editor tests, and YAML parity tests. |
| 6. Navigation/forms | `?section=` is the canonical day-section state; old `?step=` links normalize with history replacement. Direct links, reload, Back/Forward, and repair field links are covered. Draft fields expose consistent rejected-commit feedback. Rapid Alt+Arrow input advances from synchronous section state. | DayFrame URL/history/burst tests and browser navigation/export-gate tests. |
| 7. Shared evaluation | `evaluateDay` merges once, validates once, derives status from supplied issues, and fails closed. DayEditorFrame shares that result with readiness and the view model. | `dayEvaluation.ts`, view-model changes, and the full validation/export test suite. |

## Browser-test maintenance

The browser suite now selects current controls by roles, accessible names, and regions rather than retired CSS table classes. Tests open optional disclosures before interacting with secondary settings. This verifies the current information hierarchy without forcing rarely changed controls onto the main path.

Visual-regression and screenshot-generation specs are opt-in in both local and CI runs. The default `playwright test` lane therefore checks behavior without failing on legacy-form image baselines or rewriting screenshots.

## Verification

Verification completed during this implementation:

- TypeScript: passed.
- ESLint with zero warnings: passed.
- Production build: passed.
- Unit/component/integration suite: 5,705 of 5,705 passed.
- Complete default browser suite: 158 of 158 passed. Visual/screenshot baselines are opt-in.
- The updated workflow lane passed 58 of 58; its focused export/restore follow-up passed 5 of 5 before the complete run.
- CSS lint: no errors; 205 pre-existing warnings remain.
- Diff whitespace check: passed.

## Remaining maintenance

The correctness defects reproduced in A1–A8 are covered. Three broader cleanup items from the plan remain useful but do not block scientist workflows:

1. `EpochsTab.tsx` still contains substantial interaction and presentation code. Its related writes are atomic, but moving every operation and conflict-aware undo rule into named domain commands would reduce screen complexity further.
2. Repair routing is centralized, while field focus still uses registered `data-field-path` elements in the mounted editor. A typed editor registry would remove the remaining DOM lookup.
3. Shared day evaluation removes duplicate work, but no before/after browser performance profile was captured. Split store contexts or introduce more caching only if representative-workspace measurements show a user-visible delay.

These items should be treated as measured maintainability work. The existing converter, Spyglass, optogenetics, and DANDI release evidence remains tracked separately from this architecture refactor.
