# Phase 2c — AnimalView view model

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Build `buildAnimalViewModel(workspace, animalId, tab)` — the tabbed animal shell's header + grouped
section-nav (status rings) + active-tab descriptor, as data. The section-nav is the cleanest
[`SectionViewModel[]`](shared-contracts.md#sectionviewmodel) consumer; this phase mostly lifts
`AnimalView/index.tsx`'s nav-building into a builder.

**Inputs to read first:**

- [src/pages/AnimalView/index.tsx](../../../src/pages/AnimalView/index.tsx) — `SECTION_GROUPS` (grouped
  nav structure), the per-tab `getAnimalSectionStatus`/blocking ring, active-tab resolution, the
  `?field=` repair-anchor mapping, and the per-tab scope/subhead descriptors. This is the extraction
  target.
- [src/pages/AnimalView/SectionNav.module.css](../../../src/pages/AnimalView/SectionNav.module.css) — for
  reference only (the VM is style-free; it emits `status`, the component picks the class).
- [src/domain/sectionStatus.ts:92,131](../../../src/domain/sectionStatus.ts) — reused for ring status.
- Phase-0 [logic-inventory.md](phase-0-inventory.md) AnimalView section.

**Contracts referenced:** [`SectionViewModel`](shared-contracts.md#sectionviewmodel),
[`WorkflowSeverity`](shared-contracts.md#workflowseverity),
[`WorkflowAction`](shared-contracts.md#workflowaction).

## Tasks

- Create `src/viewModels/animalViewModel.ts` exporting `buildAnimalViewModel` and:

  ```ts
  export interface AnimalViewModel {
    header: { id: string; speciesLabel?: string; sexLabel?: string };
    groups: Array<{ label: string; sections: SectionViewModel[] }>;  // 'Day work' / 'Animal setup'
    activeTab: string;
    activePanel: { key: string; label: string; scope?: string };     // per-tab heading + scope subhead
  }
  ```

- Move `SECTION_GROUPS` and the nav status computation out of the component into the builder. Each
  `SectionViewModel.status` comes from `getAnimalSectionStatus` + `getAnimalBlockingSections` mapped via
  the [severity invariant](shared-contracts.md#severity-mapping-invariant); `summary`/`issueCount`/`action`
  reproduce the current ring + count + link.
- Preserve the existing tab keys/labels/order and the `Recording Days` / `Validation & Export` counts
  shown in the `Day work` group (those read day state, not just section status — keep the same source).
- Keep the `?field=` repair-anchor mapping (tab → primary `data-field-path`) as a small pure export the
  builder can expose or that stays in the component; if the audit shows the page is the only consumer,
  leave it in the page (note this in the builder doc-comment). Do not over-extract.

## Deliberately not in this phase

- No wiring of `AnimalView/index.tsx` (phase-3). No DayEditor VM. No change to which tab renders which
  panel (routing stays in the page).

## Validation slice

| Test | Asserts |
| --- | --- |
| `animalViewModel.test.ts` — groups/order | `vm.groups` reproduces the current grouped nav (labels, tab keys, order). |
| — status rings | a configured / under-configured / blocking animal yields the right `SectionViewModel.status` per tab (matches the ring shown today). |
| — counts | the `Recording Days` count + `Validation & Export` "N ready" reproduce the page values. |
| — active tab | `buildAnimalViewModel(ws, id, 'cameras')` sets `activeTab`/`activePanel` correctly; unknown tab falls back as the page does. |
| baselines | byte-identical. |

## Fixtures

Reuse the AnimalView/section-nav test fixtures (`buildRealisticWorkspace`); add an under-configured and a
blocking-section animal (shared fixtures dir from 2a/2b).

## Review

Dispatch `code-reviewer`. Confirm nav groups/labels/order + ring statuses + counts match the current
page; the VM is style-free plain data; reused domain fns (not reimplemented); typecheck/lint:ci/baselines
green; no plan-phase strings; no page wiring.
