# Phase 2b — AnimalWorkspace view model

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Build `buildAnimalWorkspaceViewModel(workspace, selectedAnimalId?)` — the picker + per-animal day-list +
first-run setup hub, as data. Reuses the [`DayRowViewModel`](shared-contracts.md#dayrowviewmodel) and
[`SectionViewModel`](shared-contracts.md#sectionviewmodel) the contract already defines (shared with 2a
and 2c). No UI change here.

**Inputs to read first:**

- [src/pages/AnimalWorkspace/index.tsx](../../../src/pages/AnimalWorkspace/index.tsx) — animal cards
  (day count via `getPresentDayCount`), empty state, create/import affordances.
- [src/pages/AnimalWorkspace/DayList.tsx](../../../src/pages/AnimalWorkspace/DayList.tsx) — the per-row
  status→label, recovery branch (`DAY_STATUS`), row actions (duplicate/delete/unlink). This is the
  `DayRowViewModel` source-of-truth display logic to extract.
- [src/pages/AnimalWorkspace/AnimalSetupCard.tsx](../../../src/pages/AnimalWorkspace/AnimalSetupCard.tsx)
  — per-section blocking/todo/done + action verb ('Fix'/'Set up'/'Review'); maps directly to
  `SectionViewModel[]`. Reuses `getAnimalSectionStatus` + `getAnimalBlockingSections`.
- [src/pages/AnimalWorkspace/ExistingDataReview.tsx](../../../src/pages/AnimalWorkspace/ExistingDataReview.tsx)
  + [RecordingDaysTab.tsx](../../../src/pages/AnimalWorkspace/RecordingDaysTab.tsx) — corrupt/orphan/
  import-recovery states and the "carry forward" + calendar affordance state.
- [src/domain/dayRecovery.ts:71,131](../../../src/domain/dayRecovery.ts) (`classifyAnimalDays`,
  `getPresentDayCount`, `dayHasArtifacts`, `describeOwner`),
  [src/domain/sectionStatus.ts:92,131](../../../src/domain/sectionStatus.ts),
  [src/domain/workflowStatus.ts:413](../../../src/domain/workflowStatus.ts).
- Phase-0 [logic-inventory.md](phase-0-inventory.md) AnimalWorkspace section, especially the
  DayList↔validationSummaryRows duplication note (the row status→label appears in both — this builder must
  consume the `dayRowViewModel` helper introduced in 2a).

**Contracts referenced:** [`DayRowViewModel`](shared-contracts.md#dayrowviewmodel),
[`SectionViewModel`](shared-contracts.md#sectionviewmodel), [`WorkflowAction`](shared-contracts.md#workflowaction),
[severity mapping](shared-contracts.md#severity-mapping-invariant).

## Tasks

- Create `src/viewModels/animalWorkspaceViewModel.ts` exporting `buildAnimalWorkspaceViewModel` and:

  ```ts
  export interface AnimalWorkspaceViewModel {
    animals: AnimalCardViewModel[];          // { id, dayCount, href }
    selectedAnimal?: {
      id: string;
      dayRows: DayRowViewModel[];
      setupSections: SectionViewModel[];     // the first-run "Set up this animal" card
      showSetupCard: boolean;
      review?: ExistingDataReviewViewModel;  // corrupt/orphan/import-recovery state
      carryForward: { available: boolean; lastDayDate?: string };
    };
    primaryAction: WorkflowAction;           // 'Create Animal' / '+ New Animal'
    importState: { canImport: boolean };
    empty?: { message: string };
  }
  ```

- The `dayRows` builder MUST produce the same `DayRowViewModel` shape as 2a. Reuse
  `src/viewModels/dayRowViewModel.ts` from 2a for the shared row-status→label + recovery + action
  translation. The recovery branch populates the shared `DayRowViewModel.recovery` +
  `recoveryDetail` (owner description + repair) and the lifecycle word rides on `lifecycle`/
  `statusLabel`. If AnimalWorkspace needs extra row fields, extend the page-specific row type around the
  shared helper rather than forking the shared status/label/recovery logic.
- `setupSections` maps `SETUP_CARD_SECTIONS` × (`getAnimalSectionStatus`, `getAnimalBlockingSections`) →
  `SectionViewModel[]` with the action verb + href the card renders today.
- Row/animal actions become `WorkflowAction`s with command descriptors
  (`{ id: 'duplicateDay', target: { dayId } }`, `{ id: 'deleteDay', target: { dayId } }`,
  `{ id: 'unlinkDay', target: { animalId, dayId } }`, `{ id: 'createAnimal' }`) — described here,
  resolved in phase-4. The builder supplies stable target/context; the component supplies only transient
  user input.

## Deliberately not in this phase

- No wiring of `index.tsx`/`DayList`/`AnimalSetupCard` (phase-3). No command handlers (phase-4). No
  AnimalView/DayEditor VMs.

## Validation slice

| Test | Asserts |
| --- | --- |
| `animalWorkspaceViewModel.test.ts` — animal cards | day counts + hrefs match `getPresentDayCount` for a multi-animal workspace. |
| — day rows parity | each `dayRow.statusLabel`/`status`/`actions` equals what `DayList` renders (and equals 2a's `DayRowViewModel` for the same day — shared-helper check). |
| — setup sections | a configured vs under-configured animal yields the right `SectionViewModel.status`/verb; a blocking section reads `error`/'Fix'. |
| — recovery/review | corrupt index, orphan day, wrong-owner day produce the right `review` + `dayRow.recovery`. |
| — empty | no animals → `vm.empty.message`. |
| baselines | byte-identical. |

## Fixtures

Reuse `buildRealisticWorkspace` + the RecordingDaysTab test fixtures; share the edge fixtures created in
2a (`src/viewModels/__tests__/fixtures/`).

## Review

Dispatch `code-reviewer`. Confirm parity with current `DayList`/`AnimalSetupCard` output; the shared
`dayRowViewModel` helper from 2a is reused (no divergent copy); plain-data; typecheck/lint:ci/
baselines green; no plan-phase strings; no page wiring.
