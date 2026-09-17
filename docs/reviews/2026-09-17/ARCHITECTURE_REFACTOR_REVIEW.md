# Architecture and maintainability review

Date: 2026-09-17. Reviewed the `modern` working tree based on `6907de8e`, including the uncommitted [C1–C8 fixes](FIXES.md). This review added documentation and diagnostic evidence; it made no application changes.

Follow-up: [ordered implementation plan and acceptance criteria](ARCHITECTURE_FIX_PLAN.md).

## Conclusion

**The recurring problem is that scientific editing rules are distributed across screens, draft callbacks, workspace updates, validation, repair routing, and export. A correct edit depends on those implementations agreeing.** Several important agreements are expressed only in comments, string paths, callback conventions, and component code.

The recent fixes improve the actual workflows. They also show where shared contracts would prevent the same classes of error elsewhere. Three focused probes confirmed remaining weaknesses: sibling edits can overwrite each other, a rejected draft commit clears the pending flag, and the shared repair catalog disagrees with the corrected screen routing. Compiler inspection also confirmed that the modern store's central API is inferred as `any`.

The next investment should be an incremental refactor of editing, identity, and repair contracts. Existing React/Vite infrastructure, domain transformations, workspace persistence, historical configuration snapshots, validation rules, and YAML adapters provide a useful foundation.

## The rules the design should enforce

| Scientist's expectation | Application invariant | Previous evidence |
| --- | --- | --- |
| “I can finish this later.” | Preserve incomplete input; distinguish a pending field, a committed workspace draft, durable browser storage, and export readiness. | C3: partial units appeared saved but disappeared. |
| “I can correct anything I entered.” | Every retained record has a reachable edit/remove surface, even if unassigned or invalid. | C1/C2: orphaned files and extra statescripts became unreachable. |
| “Changing this does not damage something else.” | Apply each operation to the latest state; update all affected relationships together; make replacement explicit. | C1/C5: deletion left hidden references; Add replaced occupied wiring. |
| “The error tells me exactly where to go.” | Field meaning, ownership, required cues, issue labels, navigation, and focus agree. | C1/C2/C6/C7/C8: repair dead ends, requirement/option/help drift. |
| “One deliberate click performs one action.” | Validation and save feedback preserve the action's position during pointer interaction. | C4 and the later save-indicator layout fix. |
| “A later setup change does not rewrite what happened.” | Defaults and recorded facts have explicit scope and history. | Existing configuration snapshots and day overrides support this and must survive a refactor. |

Stable experimenters should remain convenient defaults with a reachable exception. The corpus and user workflow do not justify making scientists re-enter them daily. Reducing accidental duplicated state must preserve intentional historical records and the existing rules about shared subject corrections.

## Findings, in priority order

P1 means address before expanding editing workflows because the contract can lose edits. P2 means address in the next structural refactor. P3 means improve after correctness, with measurement where relevant. “Confirmed” below identifies a probe or directly observed source property; it does not imply that every workflow exhibits it.

### A1 — P1: Nested field writes can overwrite a sibling edit

**Confirmed by a component/store integration probe.** In [DayEditorFrame.tsx](../../../src/pages/DayEditor/DayEditorFrame.tsx), `handleFieldUpdate` (lines 328–344) clones the `day` captured by the current render, changes a field, and submits its whole top-level parent. Two calls affecting different fields of `session` before another render both start from the same old session.

The probe invoked the real frame callback twice in one event, through a small replacement DIO panel and the real workspace provider:

```text
session.session_description    requested: description A    stored: original description
session.experiment_description requested: description B    stored: description B
```

The real action uses the latest workspace, but the submitted parent already contains stale sibling values. React batching does not make this logically safe. This is a demonstrated API defect; the probe does not establish how often a scientist triggers it through today's ordinary field controls. Multiple draft flushes and composite commands need to be safe under this contract.

**Refactor:** Move field application into a typed workspace action that reads the latest day and applies only the intended change. Related operations such as epoch deletion/reordering should produce one complete transition, including file/protocol references and relevant day state. Generate the undo operation from that transition. Preserve unrelated edits if Undo is used later.

**Related smell:** [useWorkspace.ts](../../../src/state/useWorkspace.ts), lines 70–89, deliberately runs an updater against a synchronous ref and again through React state. Its comment describes why this exists and allows timestamp differences. This is additional reasoning overhead, not a second reproduced data-loss bug. Keep transitions pure and publish a coherent result; test same-event sequencing and Strict Mode when changing this boundary.

### A2 — P1: The draft hook marks an edit clean before the writer accepts it

**Confirmed by a hook probe.** [useDraftField.ts](../../../src/hooks/useDraftField.ts), lines 74–83, clears `dirtyRef` and advances `committedRef` before invoking `onCommit`. The callback has a `void` return contract. A thrown rejection leaves the draft registry reporting no pending change:

```text
displayed draft: new
actual committed value: old
hasPendingDrafts(): false
```

The store has a legitimate rejection path: `commitWorkspace` throws for a read-only writer role in [useWorkspace.ts](../../../src/state/useWorkspace.ts), lines 94–99. The probe supplied a throwing writer; it did not reproduce a full cross-tab takeover in the browser. A callback that silently declines a value creates a similar contract problem; this was the mechanism behind the now-fixed partial-units screen.

**Refactor:** Define an explicit accepted/rejected commit result. Advance the committed baseline and clear the pending draft only after acceptance. Preserve rejected values and expose retry/recovery. Distinguish acceptance into the in-memory workspace from successful durable persistence; neither implies export readiness. Define what happens to a rejected draft during navigation/unmount, since keeping it only in an unmounted input is insufficient.

A section or record draft controller can coordinate dependent fields and flush once before navigation/export. Incomplete scientific metadata belongs in a saved draft; validation should block export without discarding that input.

### A3 — P2: Repair routing has several competing definitions

**Confirmed by a domain probe and source comparison.** [repairRouting.ts](../../../src/domain/repairRouting.ts) separately determines legacy steps, current sections, ownership, and labels using path substrings (notably lines 66–110, 142–182, and 456–487). [DayEditorFrame.tsx](../../../src/pages/DayEditor/DayEditorFrame.tsx), lines 67–118, independently translates those paths into current sections and mounted field paths.

The shared catalog currently returns:

| Issue path | Shared section | Shared button label | Correct editor |
| --- | --- | --- | --- |
| `units.analog` | None | Fix in Review & export | Recording Setup |
| `units.behavioral_events` | DIO | Fix in DIO Wiring | Recording Setup |

The latest frame-specific units patch routes these repairs correctly. That fix remains useful, but the shared labels/grouping still disagree. Each new exception has to be remembered in multiple implementations.

Focus handling adds another coupling: the frame, epoch editor, and animal view use their own field-path parsing, DOM searches, disclosure opening, and timing logic. A route existing does not establish that its input is mounted and editable.

**Refactor:** Create one typed field/repair catalog describing semantic field identity, data scope, current section, collection entity identity, display label, and the external validation path mapping. An editor registration mechanism should open the required panel/disclosure and focus its registered control. Use the same resolution for issue grouping, button labels, and navigation. Keep raw-import fallbacks explicit and testable.

This catalog should support the hand-designed scientist workflows. It need not generate every screen from a schema.

### A4 — P2: The legacy facade erases modern store type safety

**Confirmed with the TypeScript compiler API.** [store.ts](../../../src/state/store.ts), line 38, destructures the legacy hook as `any`. Spreading those values into the modern model/actions/selectors propagates `any` through the combined return value. `StoreContextValue` inherits it via `ReturnType<typeof useStore>`.

```text
model: any
selectors: any
actions: any
persistence: WorkspacePersistence
```

The project enables `strict`, but consumers of these central APIs can still supply misspelled actions or incompatible payloads without the expected checking. This is more consequential than isolated `any` at a raw-file validation boundary.

**Refactor:** Expose an explicitly typed modern workspace API and contain legacy compatibility behind its own adapter. Type action parameters/results and selectors at the boundary before converting every remaining legacy component. Give external, untrusted input an `unknown` boundary and parse it into a repairable representation; do not pretend that every imported draft is a complete export model.

### A5 — P2: File and epoch relationships rely on positions and editable text

**Confirmed representation; future failure risk, beyond the already-fixed C1/C2 workflows.** Associated-file/video records have no internal ID in [workspaceTypes.ts](../../../src/state/workspaceTypes.ts), lines 712–730. Their epoch reference is `number | string`. Both full file editors use array indices as React keys and repair addresses. [associatedFiles.ts](../../../src/domain/associatedFiles.ts), lines 14–31, infers statescript classification from editable name/description/path text.

Array position changes during deletion/reordering. Text classification can change while typing. The new full manager correctly keeps rows accessible, but the underlying model still makes editor identity, repair targeting, and reference maintenance harder than necessary. No new wrong-row browser edit was reproduced in this review.

**Refactor:** Introduce stable internal record IDs and an explicit file kind, initially using import heuristics as a suggestion. Represent an unassigned reference explicitly. Migrate incrementally, beginning with files; evaluate internal epoch identity separately from its displayed/exported number. Keep external YAML naming, order, and numeric references at the serializer boundary. Preserve unknown and malformed imported values for correction.

Stable IDs also give React reliable keys when rows move or disappear. [React's list guidance](https://react.dev/learn/rendering-lists) explains why index keys can associate state with the wrong item after a structural change.

### A6 — P2: Screen components own multi-record business operations

**Confirmed source responsibility issue.** [EpochsTab.tsx](../../../src/pages/DayEditor/EpochsTab.tsx) is 1,768 lines and owns task-catalog writes, epoch/reference changes, orphan choices, undo snapshots, deferred/videoless state, file editing, modal state, keyboard behavior, and focus. Size alone is not the finding: a presentation component has to maintain the consistency of multiple scientific records.

For example, `applyCommit` (lines 263–303) combines `repair: boolean | 'remove'`, another boolean override, and an options object while issuing several writes. Renumbering and deletion (lines 374 onward) manually coordinate reference arrays and state. Related domain helpers already exist, so this is an opportunity to finish moving orchestration to the domain boundary.

**Refactor:** Express intent with named commands and explicit variants, such as deleting an epoch with `filePolicy: 'keepUnassigned' | 'remove'`. Return the resulting change/undo information from one operation. Let the screen collect the user's choice, invoke the command, and render the result. Replace mutually dependent modal flags and pending callback refs with a discriminated interaction state where useful.

Extracting JSX into several files without moving these responsibilities would leave the same coupling. [React's state-structure guidance](https://react.dev/learn/choosing-the-state-structure) supports grouping related state and avoiding contradictory or duplicated state; intentional recording history is a separate domain requirement.

### A7 — P3: Broad context subscriptions and repeated evaluation add avoidable work

**Confirmed source behavior; no performance benchmark was run.** [StoreContext.tsx](../../../src/state/StoreContext.tsx), lines 99–111, supplies model, actions, selectors, and persistence as one context value. Its comment says memoization prevents all consumers from rerendering on unrelated state changes. Any change to one of these dependencies still changes the provider value, so that comment overstates the isolation. [React's context documentation](https://react.dev/reference/react/useContext) describes the consumer updates this causes.

The day frame computes merged metadata and validation, and its view model computes them again. In [dayEditorViewModel.ts](../../../src/viewmodels/dayEditorViewModel.ts), lines 1346 and 1371–1373, `computeStepStatus` validates internally and then `validateDay` is called separately. The API already accepts precomputed issues, which some other paths use. The frame's `getAnimalDays` result is also a newly allocated dependency.

**Refactor:** Produce one shared day evaluation containing effective metadata, issues, readiness, and provenance for a given workspace revision. Pass existing issues into status builders. Separate stable actions and persistence status from data subscriptions where it reduces measured work. Cache dependencies must include relevant animal, configuration, task/camera, and cross-day changes. Final export must evaluate the current committed snapshot rather than trust an obsolete readiness cache.

Profile a representative large workspace before introducing a different state library or elaborate caching scheme. This review establishes redundant work, not a measured typing delay.

### A8 — P3: Navigation and feedback behavior need shared UI contracts

**Navigation:** [DayEditorFrame.tsx](../../../src/pages/DayEditor/DayEditorFrame.tsx), lines 260–269, changes sections with local state. Repair links separately read hash-query state. Ordinary section navigation does not update the URL, so a scientist cannot reliably reload/bookmark that location or use browser Back to retrace those section changes. This is a usability limitation, not by itself a WCAG violation.

Use one route-backed section state and ordinary links for navigation. Keep buttons for actions. Hash routing can remain compatible with the existing static deployment.

**Forms and feedback:** The DIO and header fixes solved concrete cases where feedback moved a pending click target. Extend shared field primitives to own label, required cue, help/error association, reserved feedback space where needed, and consistent validation timing. Existing native controls, dialog behavior, draft fields, and accessibility tests are useful starting points.

Provide field-specific textual errors and programmatically associated help; announce relevant save/error status without repeatedly interrupting typing. These recommendations follow [WCAG error identification](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) and [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html). Preserve release/cancellation behavior when fixing pointer interactions, consistent with [WCAG pointer cancellation](https://www.w3.org/WAI/WCAG22/Understanding/pointer-cancellation.html).

Mixed CSS modules/SCSS and the previously reported 205 style warnings are lower-priority cleanup. They are not 205 accessibility violations. A shared set of form/layout primitives will help more than cosmetic file renaming.

## Refactor sequence and completion criteria

### 1. Make editing trustworthy

- Establish a typed modern store boundary.
- Apply nested changes against the latest record; make related domain edits one transition.
- Acknowledge accepted/rejected draft commits and preserve rejected drafts through navigation.
- Test sibling writes in one event, multiple draft flushes, rejection, save/reload, and export after a final keystroke. Assert actual retained values.

Completion: the two data-loss probes become regressions asserting the desired behavior; existing persistence, ownership, undo, and export checks still pass.

### 2. Make every value reachable and consistently described

- Consolidate semantic field IDs, requirements, ownership, issue routing, and editor registration.
- Use one URL representation for day sections and repair destinations.
- Extend shared form primitives for labels, error association, focus, and stable actions.

Completion: for every export-blocking issue, a contract test resolves a reachable editor or explicit removal/recovery action. Representative browser tests must mount and focus the actual control, not merely assert a callback or label. Include animal/day scope and hidden collection rows.

### 3. Make relationship changes explicit

- Add stable internal file IDs and explicit unassigned state, with a versioned workspace migration.
- Move epoch deletion/reordering and reference changes into commands; preserve intentional history.
- Simplify the epoch screen around these commands and existing pure transformations.

Completion: sequences of add/edit/reorder/delete/undo preserve unrelated records and retained file identity. Replay the supplied YAML corpus through import/edit/export comparison with documented normalization differences. Cover duplicate and malformed rows rather than dropping them to make types convenient.

### 4. Reduce repeated work and keep workflow evidence

- Share one evaluation result between readiness, issue lists, and section status.
- Measure and narrow subscriptions where necessary.
- Maintain first-day and follow-up browser journeys that type values, navigate, reload, repair, and assert downloaded YAML.
- Use real pointer interactions for actions whose surrounding content changes on blur/save.

Completion: the scientist can still produce equivalent consumer-accepted YAML quickly, with truthful draft/persistence/export status. Preserve the real converter smoke test, and keep the separately outstanding Spyglass/DANDI/optogenetics acceptance work visible.

## What the tests establish

The existing fixes have substantial coverage, including the previously reported 5,691 passing unit tests, browser regressions, and a real NWB conversion; see [the fix report](FIXES.md). Those results remain valuable. This review illustrates the additional need for invariants spanning components and persistence: testing a callback in isolation or exporting a prepared object cannot prove that a scientist's final input survives the entire interaction.

This review ran three focused diagnostic tests, all of which reproduced the current undesirable behavior. Their passing status means reproduction succeeded, not that the defects are resolved. The temporary active test was removed so it cannot become a regression that blesses a bug. Its source and output are retained here:

- [Probe source](architecture-evidence/architectureReview.probe.test.jsx.txt), originally run from `src/__tests__/architectureReview.probe.test.jsx` with `npx vitest run`.
- [Probe output](architecture-evidence/probe-results.txt).
- [Compiler inspection script](architecture-evidence/inspect-store-types.mjs), run from the repository root with Node, and [inferred types](architecture-evidence/store-types.txt).

This was a source/architecture review with targeted component and hook probes. It did not repeat the full browser/converter audit, benchmark performance, certify accessibility, or perform a dependency/security audit. Application fixes and broad refactoring remain future work; this review changed only documentation and diagnostic evidence.
