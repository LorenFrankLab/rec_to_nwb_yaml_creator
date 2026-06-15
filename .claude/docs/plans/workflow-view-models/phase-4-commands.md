# Phase 4 — Intent-level commands

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Add a thin command layer so the UI calls **user intent** (`createRecordingDay`, `markBadChannels`, …)
instead of editing nested workspace objects. Commands wrap the existing `workspaceActions`; they add
naming + a stable call surface, not new write logic. This is what lets the `command` ids the view-models
already carry resolve to real handlers, and it's the write-side counterpart to the read-side builders.

**Inputs to read first:**

- [src/state/useWorkspace.ts](../../../src/state/useWorkspace.ts) + [src/state/store.ts](../../../src/state/store.ts)
  — the store + the `actions` it exposes (createAnimal, updateAnimal, day CRUD, device overrides, config
  history, bad-channel marks, acks). The commands wrap THESE; read their exact signatures.
- [src/state/StoreContext](../../../src/state/StoreContext.tsx) — how components get `{ model, actions }`.
- `src/state/workspaceUtils.ts` / `workspaceSelectors.ts` — any read needed to translate an intent into
  an action arg.
- The `command` descriptors emitted by the builders (phases 2a–2d): `{ id, target, payload }` for
  `exportValidOnly`, `duplicateDay`, `deleteDay`, `unlinkDay`, `createAnimal`, plus the DayEditor write
  intents below.
- Phase-0 [logic-inventory.md](phase-0-inventory.md) rows marked **COMMAND**.

**Contracts referenced:** [`WorkflowAction.command`](shared-contracts.md#workflowaction) /
[`WorkflowCommand`](shared-contracts.md#workflowcommand) — the plain-data descriptor a command resolves;
the view-model stays data-only (the *resolution* lives here / in the page, not in the VM).

## Tasks

- Create `src/viewModels/commands/` (sibling to the builders). Export intent functions that take
  `(actions, args)` and call the matching `workspaceActions` — e.g.:

  ```ts
  // each is a thin, named wrapper — NO new write rules
  export const createRecordingDay = (actions, { animalId, date, carryForwardFromDayId }) => …;
  export const updateAnimalIdentity   = (actions, { animalId, subject }) => …;
  export const updateAnimalSetupSection = (actions, { animalId, section, value }) => …;
  export const updateDayOverview      = (actions, { dayId, patch }) => …;
  export const updateTaskEpochs       = (actions, { dayId, epochs }) => …;
  export const updateCameraUsage      = (actions, { dayId, cameraIds }) => …;
  export const markBadChannels        = (actions, { dayId, channels }) => …;
  export const acknowledgeBadChannelRemoval = (actions, { dayId, channel }) => …;
  export const applyConfigurationChange = (actions, { animalId, change }) => …;
  ```

- Provide one resolution map `commandHandlers(actions)` → `Record<commandId, (descriptor, input?) => void>`
  so a page can do:

  ```ts
  const run = commandHandlers(actions);
  <button onClick={() => run[action.command.id](action.command, transientInput)} />
  ```

  The descriptor's `target`/`payload` comes from the VM. The optional `transientInput` is only for values
  the user just typed/selected and the builder cannot know at render time. Keep inputs intent-shaped, not
  raw nested workspace objects.
- Migrate each page's write call sites (the handlers Phase 3 left pointing at the old inline edits) to
  call the command descriptor. Remove the old inline nested-object edit code paths in the same PR (no
  parallel write paths). This can be one PR per surface or one command PR — recommend **one command PR**
  since the wrappers are small and share the resolution map; split only if a surface's writes are large.
- Bad-channel commands MUST preserve the monotonicity model exactly (`markBadChannels` carries forward;
  `acknowledgeBadChannelRemoval` records the off-export ack; un-mark without ack still blocks export).
  These wrap the existing `badChannelMonotonicity`-backed actions — do not reimplement the rules.

## Deliberately not in this phase

- No new write semantics, validation, or store-shape changes — commands are 1:1 named wrappers over
  existing actions. If an intent needs logic the store doesn't have, that's a store change called out
  explicitly, not hidden in a command.
- No UI redesign (phase-6).

## Validation slice

| Test | Asserts |
| --- | --- |
| `commands/*.test.ts` per command | calling the command invokes the right `workspaceActions` with the translated args (use a spy/fake actions object). |
| `createRecordingDay` carry-forward | with `carryForwardFromDayId`, the new day inherits the prior same-config day's marks (matches current behavior). |
| `acknowledgeBadChannelRemoval` | records the ack; a subsequent export gate no longer reports `bad_channel_unfailed_without_ack` for that channel. |
| `markBadChannels` monotonic | un-marking an earlier-bad channel without ack still blocks export (rule preserved). |
| integration (per migrated surface) | the page's button now routes through the command and produces the same store mutation as before (existing write tests pass). |
| baselines | byte-identical (writes unchanged → export unchanged). |

## Fixtures

Reuse store/action test fixtures; a fake `actions` object (spies) for the unit tests; the existing
bad-channel monotonicity fixtures for those cases.

## Review

Dispatch `code-reviewer`. Confirm: commands are thin wrappers (no new write logic — diff each against the
action it calls); old inline write paths removed (no parallel v1/v2); monotonicity/ack behavior
identical (real tests, not mock-only); typecheck/lint:ci/baselines green; no plan-phase strings.
