# Architecture fix plan

Date: 2026-09-17. Implementation plan for findings A1–A8 in the [architecture review](ARCHITECTURE_REFACTOR_REVIEW.md). The correctness-bearing work was implemented on the `modern` branch; see the [implementation report](ARCHITECTURE_IMPLEMENTATION.md) for exact coverage, verification, and remaining structural cleanup. The working tree also contains the separately verified [C1–C8 fixes](FIXES.md), which formed the starting point.

## Outcome

A scientist can set up an animal, enter a recording day quickly, leave incomplete work, resume later, correct any retained value, and download metadata that reflects the final edits. A follow-up day inherits stable defaults while preserving the recording's own facts and applicable historical configuration.

The code should enforce that behavior through a small set of shared contracts:

1. An edit applies to the latest record, and related changes succeed together.
2. Draft acceptance, durable saving, and export readiness are separate states.
3. Every retained value has a stable identity and a reachable editor or recovery/removal action.
4. Labels, requirements, issue grouping, navigation, and focus agree about each field.
5. Historical configurations and day facts retain their existing scope.

## Delivery order

Use seven implementation groups, each suitable for a separately reviewable PR. Include focused regression tests with the change they protect. Complete the two data-loss groups first; their delivery does not depend on the later model migration.

| Group | Work | Findings | Main dependency |
| --- | --- | --- | --- |
| 1 | Typed modern editing API and safe updates | A1, A4 | Existing C1–C8 baseline |
| 2 | Acknowledged draft commits and truthful save/export behavior | A2 | Group 1 commit contract |
| 3 | One repair catalog and editor targeting mechanism | A3 | Typed field/record targets |
| 4 | Atomic epoch/file operations and simpler screens | A6, remaining A1 orchestration | Groups 1–2 |
| 5 | Stable file identity and workspace migration | A5 | Groups 3–4 |
| 6 | Consistent navigation and form feedback | A8 | Groups 2–3; collection controls use group 5 IDs |
| 7 | Shared day evaluation and measured rendering improvements | A7 | Correctness contracts above |

After these groups, run the integrated acceptance pass below. Retain the current React/Vite stack and persistence engine. Keep rare settings in disclosures and stable experimenters inherited by default. Shared components must preserve the deliberate daily-entry layout and useful quick-entry controls.

## Before implementation: preserve the verified starting point

- Record the exact baseline revision and existing uncommitted C1–C8 changes. Keep those changes logically separate from this refactor when making commits.
- Use the previous browser fixtures, downloaded YAML, migration fixtures, and real-conversion evidence as comparison inputs.
- Convert the architecture diagnostic probes into regressions asserting the desired behavior, paired with their fixes. The diagnostic tests currently assert the defects; copying them unchanged would protect the wrong behavior.
- Capture baseline rendering/evaluation measurements for a small workspace and a larger workspace built from the supplied data. Record workspace size, browser, machine, action, and repeated-run results so group 7 has a meaningful comparison.

## Group 1 — Typed modern editing API and safe updates

**Implementation**

- Expose explicit modern workspace, action, selector, and commit-result types. Isolate the legacy facade so spreading legacy `any` cannot erase the modern API's types.
- Keep one workspace owner/provider. The typed modern API and legacy compatibility adapter must access the same state; introducing a second workspace hook instance would create divergent stores.
- Move nested field updates into the state boundary. Apply each leaf change against the latest day rather than cloning the day captured by the screen's render.
- Prefer typed field changes or named section actions over arbitrary string-path/object writes. Keep any temporary path adapter narrow and remove its modern callers as the field catalog is introduced.
- Give the modern commit boundary an explicit accepted/rejected result. Expected rejection reasons include read-only ownership or a missing record. Unexpected exceptions must also leave callers aware that acceptance failed.
- Keep transition functions pure: create timestamps/IDs once per operation and pass them in. Refactor the ref/React publication mechanism so same-event actions and immediate saves see the same accepted snapshot; do not remove its synchronous visibility guarantee.

**Primary code:** `state/store.ts`, `StoreContext.tsx`, `useWorkspace.ts`, `workspaceActions.ts`, `workspaceTransitions.ts`, `DayEditorFrame.tsx`, and modern context consumers.

**Done when**

- Two sibling edits in one event both survive; a later deliberate edit to the same field wins.
- Multiple commands followed immediately by Save/export use the final accepted snapshot.
- Rejected commands leave the workspace unchanged.
- Strict Mode and composite import/configuration workflows preserve IDs, revision selection, and latest-state behavior.
- Compiler checks reject an unknown action and an incompatible payload. Modern model/actions/selectors no longer infer as `any`; repairable raw input remains explicitly represented.

## Group 2 — Acknowledged drafts, navigation, and persistence

**Implementation**

- Update `useDraftField` to clear a pending draft only after the writer accepts that value. Keep the latest typed value and its error on rejection.
- Replace the draft registry's flush count with a structured result distinguishing accepted, rejected, and explicitly unapplied drafts. Process independent drafts without letting one rejection silently hide the others.
- Retain pending/rejected field values in a workspace-scoped draft controller that outlives an individual input. Key entries by record and field; use stable collection IDs once group 5 lands. Returning to a screen must restore its draft. Dispose entries when their value is accepted or the user explicitly discards/removes the relevant record.
- Preserve the separate Save/Cancel contract of setup dialogs. Global Save and export must not silently apply an unapplied setup decision.
- Make Save, keyboard Save, navigation, export, page-exit handling, and writer handover consume the same flush result. A partial/rejected flush cannot report a fully successful save or allow an export that silently omits displayed edits.
- Successful acceptance updates the workspace. A successful persistence write updates the saved indicator. Incomplete values can be durably saved while export remains blocked.
- Keep rejected edits available during in-app navigation. On persistence failure, retain unsaved status and the existing retry/backup recovery path. Browser-exit handling remains a best-effort guard; it cannot guarantee storage when the browser or storage has failed.

**Primary code:** `hooks/useDraftField.ts`, `state/draftRegistry.ts`, `useWorkspacePersistence.ts`, `components/ui/DraftFields.tsx`, unapplied/unsaved guards, and all save/export entry points.

**Done when**

- A rejected writer leaves the displayed draft, pending flag, and committed value consistent; retry succeeds without retyping.
- A draft survives input unmount and in-app return. Rapid successive input/flush operations preserve the newest value.
- Several pending fields flush correctly before Save and download.
- Partial units survive reload and still block export until complete; clearing both removes the optional block.
- A read-only rejection or storage failure never produces a false Saved indication. Writer handover refuses to discard unsaved work.
- Setup-dialog Cancel discards only that dialog's proposed changes; global Save does not apply them.

## Group 3 — One repair catalog and reachable editors

**Implementation**

- Define a typed repair target containing scope, current section, semantic field, and optional collection record identity. Map external YAML/AJV paths to these targets at the validation boundary.
- Centralize field labels, requirements/help metadata, and editor destinations. Required cues must stay consistent with the authoritative schema/rules, including conditional requirements such as fields inside an optional file record.
- Resolve ownership from the effective field's provenance where needed: the same kind of field can belong to animal setup or a day override. Avoid treating ownership as an unconditional static label.
- Replace the independent substring maps in `repairRouting`, the day frame, and related issue consumers. Remove each old branch after its callers use the common resolver.
- Register editors by target. A repair action opens the section and relevant disclosure/drawer, waits for the registered control to mount, then focuses it. Handle stale/deleted targets with a visible recovery destination. Eliminate duplicated timeout/DOM-query routing.
- Provide explicit collection/recovery targets for malformed imports and unknown fields. Preserve raw source data even when a normal field editor cannot represent it.

**Primary code:** `domain/repairRouting.ts`, validation issue types/producers, `DayEditorFrame.tsx`, `EpochsTab.tsx`, animal/import repair views, and review/view-model consumers.

**Done when**

- Both units errors name Recording Setup and focus the correct technical input.
- Every emitted blocking issue resolves to an editor or an explicit recovery/removal action; unknown/corrupt data has a useful fallback.
- Browser cases exercise mounted controls for a day field, animal field, hidden file, unassigned video, and malformed collection.
- Issue grouping, button wording, navigation, and focus resolve from the same target; existing cross-day/animal repair paths still work.

## Group 4 — Atomic domain operations and simpler screens

**Implementation**

- Build named commands around the existing pure epoch helpers: add, insert, move, delete, duplicate, change task context, and reassign/remove associated files.
- Each command reads the latest workspace and computes all affected values together: task instances/catalog changes, file/video/protocol references, and deferred/videoless state. Include only changes that belong to that operation.
- Use explicit choices such as `filePolicy: 'keepUnassigned' | 'remove'`. Keep create and replace distinct so Add cannot silently overwrite an existing identity, including DIO wiring.
- Flush applicable drafts before a structural command; respect rejected/unapplied edits. Explicit deletion disposes the deleted record's draft only after the command is accepted.
- Return operation-specific undo information. Undo must preserve unrelated edits made afterward; when a touched value has subsequently changed, surface a conflict instead of restoring a whole stale day.
- Replace screen-owned mutation orchestration and pending callback chains. Model mutually exclusive interaction states explicitly. Extract presentation pieces after command responsibilities have moved.

**Primary code:** `domain/epochOperations.ts`, workspace actions/transitions, `EpochsTab.tsx`, associated-file editors, and relevant DIO operations.

**Done when**

- Delete with either file policy, reassign, reorder, and undo preserve correct references and unrelated fields.
- Reference changes cover videos, statescripts, FsGUI protocols, and day state, with no intermediate persisted partial operation.
- Sequence tests cover add → edit → move → delete → undo, including sparse/duplicate imported references that require repair.
- Undo after an unrelated weight/note edit keeps that later edit.
- The epoch component primarily renders state and invokes commands; domain consistency is tested outside the component.

## Group 5 — Stable file identity and a reversible migration

**Implementation**

- Add persistent internal IDs to associated files and videos. Use them for React keys, draft ownership, commands, and repair targets. Existing records retain IDs through edits and reloads; creation/duplication allocates new IDs once per operation. Preserve array order for external serialization.
- Add explicit internal file-kind metadata initialized at import/creation. Editable text must not silently change editor identity or hide a row. If the scientist needs to change kind, expose it in the existing detailed manager. Keep kind/description behavior consistent with the converter and Spyglass; do not silently rewrite imported text to satisfy the classification.
- Represent unassigned linkage explicitly and retain malformed raw references for repair. Centralize translation to/from the current numeric YAML epoch references.
- Keep epoch numbers for this refactor and route all renumbering through group 4 commands. A separate epoch-ID migration is unnecessary to complete these fixes while that invariant holds.
- Add the next migration to `workspaceMigrations.ts`—currently version 4—and update persistence and backup fixtures. Existing IDs survive subsequent loads; duplicate filenames receive distinct IDs; raw pre-migration bytes remain preserved through the existing preservation mechanism.
- Ensure internal IDs/kinds never leak into exported metadata or alter export freshness when effective YAML/filename are unchanged. Update import, copy, merge, backup, and restore paths together.

**Primary code:** workspace types/migrations, persistence/backup boundaries, import and copy paths, `domain/associatedFiles.ts`, epoch/file view models, collection editors, and export serialization.

**Done when**

- Existing supported backup versions migrate, save, reload, and restore with stable IDs and preserved records.
- Deleting/reordering an adjacent row leaves focus and pending text attached to the intended file.
- Duplicate names, multiple statescripts per epoch, unassigned files, and invalid imported references remain individually editable/removable.
- Valid existing fixtures retain equivalent effective YAML and filename; internal-only migration does not mark a download stale.
- Corpus comparison reports every difference or rejection. Invalid source files remain repairable and are not counted as successful exports merely because rows were dropped.

## Group 6 — Predictable navigation and shared form behavior

**Implementation**

- Use URL state as the source of the current day section. Preserve existing hash routes/deep links with an adapter. Ordinary section navigation creates history entries; normalization of old routes uses replacement so it does not create loops.
- Use links for section navigation, retain keyboard shortcuts, and integrate the group 2 draft controller. Back/Forward, reload, direct links, and same-day repair links should resolve through the same mechanism.
- Extend the existing form primitives with consistently associated labels, required cues, help/errors, and validation timing. Apply first to daily entry, technical units, DIO, and file management, then the remaining modern field editors identified in the coverage inventory.
- Keep feedback from moving an action during pointer interaction. Use concise status announcements; preserve normal click release/cancellation and existing dialog focus behavior.
- Preserve routine quick entry, optional disclosures, next-free DIO suggestions, and stable experimenter defaults. Corrected inputs should not trigger unnecessary screen changes or repeated confirmation.

**Primary code:** hash routing hooks, day/animal navigation, field components, feedback/layout styles, and repair focus registration.

**Done when**

- Back/Forward, reload, bookmark/direct link, and repair navigation restore the expected section and values.
- One real pointer click after typing a custom DIO name or completing the last field performs the intended action, at desktop and narrow widths.
- Errors name the affected field and are associated with the control; keyboard/screen-reader checks cover focus after navigation, repair, add/remove, and dialog close.
- Existing daily/follow-up workflows remain compact and expose exceptional settings when needed.

## Group 7 — Shared evaluation and measured rendering

**Implementation**

- Produce a shared day evaluation containing effective metadata, validation issues, status, and provenance. Pass precomputed issues into status builders instead of revalidating within each builder.
- Reuse that evaluation for readiness, repair lists, and section summaries. Keep validation failures fail-closed with a recoverable error presentation.
- Separate stable actions, persistence status, and data subscriptions where baseline measurements demonstrate wasted work. Use the existing state infrastructure first.
- Invalidate evaluation when any relevant day, animal, configuration, task/camera definition, or cross-day constraint changes. Final export flushes accepted drafts and evaluates the current snapshot.
- Update comments that overstate memoization or stability. Address touched style warnings while consolidating primitives; unrelated legacy CSS cleanup can stay in separate maintenance work.

**Done when**

- Changing a weight, camera calibration, task definition, configuration, or relevant earlier-day fact updates readiness and export correctly.
- Navigation/persistence-only updates no longer repeat expensive evaluation without a data dependency change.
- Before/after measurements show no typing or navigation regression on representative workspaces; report measured changes rather than infer speed from fewer lines or hooks.

## Integrated acceptance and release boundary

Run tests appropriate to each group as it lands. At the completed integration, run the full unit suite, TypeScript, ESLint, CSS checks, production build, and the relevant browser suite. Do not repeatedly run the full converter after unrelated style changes; run it after the completed metadata/editing changes and again only if a later change can affect its result.

The final browser journeys must use actual inputs/actions and inspect downloaded YAML:

| Journey | Required evidence |
| --- | --- |
| First animal and recording | Supported subject facts, setup, epochs, files, wiring, weight, review, and download can be entered without hidden repair dead ends. |
| Follow-up recording | Stable defaults carry appropriately; measurements and daily facts remain accurate; exceptions affect the intended day. |
| Backfilled date / setup change | The applicable historical configuration is used; metadata entry time does not choose a newer setup accidentally. |
| Interrupted entry | Final keystrokes and partial values survive save/reload; rejected commits remain recoverable; unapplied dialogs retain Save/Cancel meaning. |
| Correction | Duplicate/unassigned files, epoch deletion/reordering, occupied DIO, undo, and repair links all lead to a usable export. |
| Portability / ownership | Backup, migration, restore, writer takeover, and storage failure do not silently discard current edits. |
| Accessibility / navigation | Desktop and narrow layouts, real pointer clicks, keyboard focus, error associations, and browser history behave consistently. |

Compare import/edit/export behavior against the supplied YAML collections. Compare supported exports semantically and check filenames, ordering where meaningful, units, identifiers, epoch references, and historical values explicitly. Preserve a manifest of rejected/malformed sources and intentional normalization differences.

Repeat the known real `trodes_to_nwb` conversion with YAML downloaded from the finished UI. Reopen the NWB and verify electrodes, epochs, tasks/cameras, video references, and statescript contents, then rerun the existing validation checks.

The refactor is complete when A1–A8 meet their stated acceptance criteria and the previously fixed C1–C8 workflows still pass. Broader production acceptance continues to require the separately identified representative Spyglass ingestion, optogenetics conversion, and DANDI validation work; keep those results separate from a claim that this architecture refactor is verified.

## Commit organization

Use the seven group boundaries above. Within a larger group, keep commits coherent: contract/transition plus its tests; caller migration; removal of superseded code. Land a storage migration together with its readers, writers, exporters, and fixtures so an intermediate commit does not emit incompatible metadata. Each merged group should leave the app runnable and its relevant checks passing.

Record results and remaining limitations in this directory as groups complete. Remove temporary compatibility paths once their final caller is migrated, so the refactor reduces the number of competing implementations.
