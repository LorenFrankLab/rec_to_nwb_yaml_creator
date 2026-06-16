# Epoch-editor redesign — implementation plan

**Status:** Not started.

Ship the reviewed day/animal redesign into the live `modern` app, screen by screen, as a presentation
reshape over the existing workspace substrate (state, export merge, validation gate, view-model layer all
reused). The exported YAML stays byte-identical. Design source is the committed mockup set in this
directory — see [README.md](README.md) for the screen-by-screen visual reference.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained (inputs to read,
   contracts/designs it depends on, tasks, validation slice, fixtures, review).
2. **Need shared semantics / what to reuse?** [shared-contracts.md](shared-contracts.md).
3. **Need a per-component design (epoch grid join, data-folder derivation)?** [designs.md](designs.md).
4. **Need scope / risks / integration points / rollout?** [overview.md](overview.md).
5. **Need the visual target?** [README.md](README.md) + the `*.html` mockups beside it.

## Files

- [overview.md](overview.md) — scope, integration points, non-goals, risks, rollout, effort.
- [shared-contracts.md](shared-contracts.md) — byte-identity gate, substrate to reuse, status vocabulary, command wiring, epoch join-view, data-folder model, carry-forward, routing.
- [designs.md](designs.md) — epoch-grid join/write-back, filename derivation, generated-files/video-3-state, issue-driven readiness/repair.
- Phases (each ships as a separable PR):
  - [phase-0-shared-primitives.md](phase-0-shared-primitives.md) — status pill, undo toast, blast-radius chip, scope-boundary card, generated-value chip, readiness bar (reused across phases).
  - [phase-1-animals-home.md](phase-1-animals-home.md) — Animals home (restyle `AnimalWorkspace`): table, search/filters, status rollup, empty state, load banner.
  - [phase-2-animal-page.md](phase-2-animal-page.md) — Animal page Days + Setup: scope chips, config card, Days multi-select + bulk export + undo, blast-radius chips.
  - [phase-3-day-frame-tabs.md](phase-3-day-frame-tabs.md) — Day-editor frame + Day / Failed-channels / DIO tabs (3 of 4); issue-driven readiness bar.
  - [phase-4-epoch-grid.md](phase-4-epoch-grid.md) — the Epochs tab: epoch-grid spine (a join-view over the **already-live** task catalog + the day's arrays) + drill-in (3 groups), filename derivation, generated-files/data-folder, video 3-state, epoch actions, field-level repair.
  - [phase-5-export-preview.md](phase-5-export-preview.md) — Export preview + batch: readiness gate, derived filename, YAML preview, download/copy success, batch result.
  - [phase-6-create-animal-wizard.md](phase-6-create-animal-wizard.md) — guided new-animal wizard (Identity → Electrodes → Cameras → Opto → Tasks → Recording system → Team). (The day-level data-folder field belongs to Phase 3, not the wizard.)
  - [phase-7-import-copy.md](phase-7-import-copy.md) — Import & repair (teaching validation) + copy-from-animal flow.
  - [phase-8-recovery-empty-polish.md](phase-8-recovery-empty-polish.md) — Recovery review, remaining empty states, keyboard shortcuts, a11y (axe) + e2e, retire-old-editor sweep.
