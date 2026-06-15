# Phase 4 — Intent-level commands

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Add a thin command layer for the **plain-data command descriptors the view-models already emit**. This
phase resolves those `WorkflowCommand.id`s to the existing handlers/actions; it does **not** commandify
every editable field write in the app. Commands wrap the existing `workspaceActions` / repair executor;
they add naming + a stable call surface, not new write logic.

Scope correction from the Phase-0 inventory: rows such as `updateDayOverview`, `markBadChannels`,
`updateTaskEpochs`, and `updateCameraUsage` remain valid **future intent candidates**, but they are not
required for this phase unless a VM already emits that descriptor. The editable controls still own their
transient value computation and call the existing write handlers; Phase 6 can promote one of those writes
to a command when a UI experiment actually needs that boundary.

**Inputs to read first:**

- [src/state/useWorkspace.ts](../../../src/state/useWorkspace.ts) + [src/state/store.ts](../../../src/state/store.ts)
  — the store + the `actions` it exposes. Descriptor commands wrap these exact signatures.
- [src/state/StoreContext](../../../src/state/StoreContext.tsx) — how components get `{ model, actions }`.
- [src/state/repairCommands.ts](../../../src/state/repairCommands.ts) — the existing serializable repair
  dispatcher. The repair half of this phase should delegate here, not create a parallel executor.
- `src/state/workspaceUtils.ts` / `workspaceSelectors.ts` — any read needed to translate a descriptor into
  an action arg while preserving today's behavior.
- The `command` descriptors emitted by the builders (phases 2a–2d): `{ id, target, payload }` for
  `createAnimal`, `deleteDay`, `duplicateDay`, `removeDayReference`, `unlinkDayReference`,
  `relinkDayReference`, `validateAllDays`, `exportValidOnly`, `exportDay`, `navigateDaySection`, and the
  executable repair descriptors (`resetDayCollection`, `removeDeviceOverride`, bad-channel ack repairs,
  etc.).
- Phase-0 [logic-inventory.md](phase-0-inventory.md) rows marked **COMMAND** — use it to distinguish
  descriptors already emitted now from field-write intent candidates deferred to later UI work.

**Contracts referenced:** [`WorkflowAction.command`](shared-contracts.md#workflowaction) /
[`WorkflowCommand`](shared-contracts.md#workflowcommand) — the plain-data descriptor a command resolves;
the view-model stays data-only (the *resolution* lives here / in the page, not in the VM).

## Tasks

- Create `src/viewModels/commands/` (sibling to the builders). Export descriptor handlers that take
  `(actions, descriptor, input?)` or small named wrappers and call the matching existing handler/action.
  The initial command set is **descriptor-complete**, not write-surface-complete:

  ```ts
  // each is a thin, named wrapper — NO new write rules
  export const duplicateDay = (actions, { dayId }, { date }) => actions.duplicateDay(dayId, date);
  export const deleteDay = (actions, { animalId, dayId }) => actions.deleteDay(dayId, animalId);
  export const relinkDayReference = (actions, { animalId, dayId }) => actions.relinkDayReference(animalId, dayId);
  export const applyRepair = (actions, descriptor, ctx) => applyRepairCommand(toRepairCommand(descriptor), ctx);
  ```

- Provide one resolution map `commandHandlers(actions)` → `Record<commandId, (descriptor, input?) => void>`
  so a page can do:

  ```ts
  const run = commandHandlers(actions);
  <button onClick={() => run[action.command.id](action.command, transientInput)} />
  ```

  The descriptor's `target`/`payload` comes from the VM. The optional `transientInput` is only for values
  the user just typed/selected and the builder cannot know at render time (for example duplicate date or
  create-animal form data). Keep inputs intent-shaped, not raw nested workspace objects.
- Wire the pages' **VM-rendered action buttons** through the resolver. Do not migrate unrelated editable
  field writes in this phase. Existing local write handlers remain for field editing, bad-channel checkbox
  value computation, camera toggles, task edits, and configuration forms unless the page is already
  invoking a VM-emitted command descriptor.
- Reuse `applyRepairCommand` for executable repairs. `acknowledgeBadChannelRemoval` should adapt to the
  existing `acknowledgeBadChannelRemovals` repair command shape (`acks: { [ntrodeId]: number[] }`) and use
  that executor, so the off-export ack merge remains one implementation.
- Add a descriptor coverage test: every command id emitted by the builders/VM fixtures has a handler, and
  every handler exercised in this phase is thin over an existing action or `applyRepairCommand`.

## Deliberately not in this phase

- No new write semantics, validation, or store-shape changes — commands are 1:1 named wrappers over
  existing actions or `applyRepairCommand`. If an intent needs logic the store doesn't have, that's a
  store change called out explicitly, not hidden in a command.
- No broad field-write migration. `updateDayOverview`, `markBadChannels`, `updateTaskEpochs`,
  `updateCameraUsage`, etc. are deferred until a future UI experiment needs those write boundaries.
- No UI redesign (phase-6).

## Validation slice

| Test | Asserts |
| --- | --- |
| `commands/*.test.ts` per VM-emitted command | calling the command invokes the right `workspaceActions` / `applyRepairCommand` with translated args (use a spy/fake actions object). |
| descriptor coverage | every command id emitted by builder fixtures has a handler; unknown ids no-op or surface a tested safe failure. |
| `acknowledgeBadChannelRemoval` adapter | delegates to `applyRepairCommand({ type: 'acknowledgeBadChannelRemovals', acks })`; a subsequent export gate no longer reports `bad_channel_unfailed_without_ack` for that channel. |
| integration (per migrated action button) | the VM-rendered button routes through the command and produces the same store mutation as before (existing write tests pass). |
| baselines | byte-identical (writes unchanged → export unchanged). |

## Fixtures

Reuse store/action test fixtures; a fake `actions` object (spies) for the unit tests; the existing
bad-channel monotonicity fixtures for ack adapter cases.

## Review

Dispatch `code-reviewer`. Confirm: commands are thin wrappers (no new write logic — diff each against the
action/executor it calls); VM-emitted command ids are handler-covered; non-descriptor field writes were not
pulled into this phase; monotonicity/ack behavior is identical (real tests, not mock-only);
typecheck/lint:ci/baselines green; no plan-phase strings.
