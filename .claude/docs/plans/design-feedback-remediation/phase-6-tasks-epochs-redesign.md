# Phase 6 — Tasks & Epochs in-place clarity redesign (F4 quick wins)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The most-confusing screen. This phase ships the **merge-neutral** clarity fixes (no model/export change),
each mapped to the [UX rubric](../../research/ux-principles.md): remove decorative emoji, add a plain-language
framing, replace glyph status with text+color, apply progressive disclosure, surface the hidden coupling,
and pull the read-only inherited events out of the edit modal. It rides on the `DayEditorContext` from
[Phase 5](phase-5-dayeditor-structural-prep.md). The task-type catalog model change is
[Phase 8](phase-8-task-type-catalog.md); build this UI so the catalog slots in cleanly.

**Inputs to read first:**

- `src/pages/DayEditor/TasksEpochsStep.jsx` — the step shell (7 stacked surfaces); camera-banner emoji 📹 at ~`:314`. Now consumes `DayEditorContext` (Phase 5).
- `src/pages/DayEditor/TasksTable.jsx` — empty-state emoji 🧩 at `:149`; status glyphs ✓/⚠/❌ at ~`:217-223` (⚠ overloads "no epochs OR missing camera"); intro text ~`:173-178`.
- `src/pages/DayEditor/TaskModal.jsx` — 4 accordions; the read-only inherited-events section at ~`:326-331`; the Cameras accordion ~`:269`.
- `src/pages/DayEditor/TaskEpochsEditor.jsx` — dual-field epoch entry; the "number persists / times are ephemeral" hint ~`:149-151`.
- `src/pages/DayEditor/BehavioralEventsDisplay.jsx` — lock emoji 🔒 at `:101` (step-level inherited events; where they belong).
- `src/pages/DayEditor/AssociatedVideosEditor.jsx` / `AssociatedFilesEditor.jsx` / `FsGuiSection.jsx` — reference a task's epochs (the hidden coupling to surface).
- `src/__tests__/integration/axe-a11y.test.jsx` — the existing zero-violations harness to extend.
- [ux-principles.md](../../research/ux-principles.md) — the rubric each task maps to.

**Contracts referenced:**

- [C1 — YAML byte-identity](shared-contracts.md#c1) — UI/copy only; `day.tasks` and the export are unchanged.
- [C3 — Task-type catalog model](shared-contracts.md#c3) — do **not** implement it here, but structure the Tasks section so the Phase 8 catalog (pick + order) drops in without another rewrite.
- [C4 — tokens / status labels](shared-contracts.md#c4) — status text+color use tokens; one consistent style.

## Tasks

- **Remove decorative emoji** (rubric 8): 🧩 (`TasksTable.jsx:149`), 📹 (`TasksEpochsStep.jsx:314`), 🔒 (`BehavioralEventsDisplay.jsx:101`). Replace with plain text where a marker aids meaning (e.g. an "Inherited (read-only)" tag instead of the lock). Add a guard test that these components contain no emoji.
- **Text+color status, de-overloaded** (rubric 9): replace ✓/⚠/❌ badges (`TasksTable.jsx:217-223`) with token-colored text labels ("Complete" / "Needs epochs" / "Missing camera" / "Error"), splitting the ⚠ that currently means two different problems.
- **Framing intro** (rubric 1,6): a short intro at the top of `TasksEpochsStep` defining, plainly, a *task* (one activity in one environment, with its cameras) and an *epoch* (a numbered time block of that task), and that each epoch belongs to exactly one task.
- **Progressive disclosure** (rubric 2,3): lead with the Tasks table; collapse the optional surfaces by default — the Cameras accordion in `TaskModal` (`:269`, open only on a dangling-camera error), and `AssociatedVideosEditor`/`AssociatedFilesEditor`/`FsGuiSection` as collapsed sections.
- **Surface the hidden coupling** (rubric 5): a one-line note that videos/files/FsGUI reference a task's epochs, and that editing/deleting a task will prompt before orphaning those references (so the repair dialog is expected, not a surprise).
- **Move inherited events out of the edit modal** (rubric 1): remove the read-only inherited-events section from `TaskModal` (`:326-331`); they already display at step level in `BehavioralEventsDisplay`.
- **Normalize** add-button labels and heading levels across the sub-editors (rubric 8).
- **Keep the data model unchanged**: `day.tasks` stays inline; no `mergeDayMetadata` change.
- Documentation: CHANGELOG; update any user-facing Tasks & Epochs guidance.

## Deliberately not in this phase

- The **task-type catalog** / epochs-as-day-collection model change, and any `mergeDayMetadata` change — [Phase 8](phase-8-task-type-catalog.md).
- The DIO Type+Index control — [Phase 1](phase-1-quick-wins-day-order-dio.md).
- Broad component decomposition / `DayEditorContext` — done in [Phase 5](phase-5-dayeditor-structural-prep.md); keep any further splits local and behavior-preserving.

## Validation slice

| Test | Asserts |
| --- | --- |
| guard test | no emoji characters remain in `TasksEpochsStep`/`TasksTable`/`TaskModal`/`BehavioralEventsDisplay`. |
| component: status rendering | each status renders a text+color label; "no epochs" and "missing camera" are distinct messages (not one ⚠). |
| component: `TaskModal` | no inherited-events section inside the modal; Cameras accordion collapsed unless there's a dangling-camera error. |
| jest-axe (extend `axe-a11y.test.jsx` or a new spec) | the redesigned Tasks & Epochs step has **zero axe violations** (collapsible sections, status labels, headings). |
| `npx vitest run baselines` | byte-identical — `day.tasks` and export unchanged (C1). |
| e2e | the screen shows the intro, collapsible optional sections, and text status; opens/edits a task without the inherited-events section. |

## Fixtures

Reuse existing day/task fixtures (a day with tasks, epochs, a dangling-camera case, associated videos
referencing epochs). No YAML fixture changes.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- Every rubric-mapped task implemented; no emoji; status text+color and de-overloaded; **jest-axe clean**.
- `day.tasks`/export untouched (baselines byte-identical); the screen is structured for the Phase 8 catalog without another rewrite; it consumes `DayEditorContext`.
- Inherited events no longer in the task edit modal; optional sections progressively disclosed.
- Names don't reference this plan; CHANGELOG + user docs updated.
