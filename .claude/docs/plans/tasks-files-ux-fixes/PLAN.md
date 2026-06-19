# Tasks & Files UX Fixes — Implementation Plan

**Status:** Not started.

The Day Editor's **Tasks & Files** surface (the epoch grid, the per-epoch details drawer, and the
supplemental-files editor) works but mis-signals: a normal new recording day renders as a wall of
error-red even when nothing blocks export, the floating details panel covers the page's own repair
buttons, the one blocking issue we tested ("video references a missing camera") has no control to fix
it, and reassigning an epoch's task silently leaves a stale auto-derived filename. This plan corrects
those across five independently-shippable PRs **without changing a single byte of exported YAML** — the
golden-baseline suite gates every phase.

## Reading order

For agent invocation, **load only the slice you need**:

1. **Working a specific phase?** Open the matching phase file — each is self-contained.
2. **Need shared semantics?** [shared-contracts.md](shared-contracts.md).
3. **Need broader scope / risks / rollout?** [overview.md](overview.md).

## Files

- [overview.md](overview.md) — scope, integration points, byte-identity invariant, risks, rollout.
- [shared-contracts.md](shared-contracts.md) — the severity→presentation vocabulary (incl. the
  3-state video camera model), the `data-field-path` repair-anchor convention + video repair surfaces,
  and the view-model ⇔ gate parity rule. Referenced by ≥2 phases.
- Phases (each ships as a separable PR, in priority + dependency order):
  - [phase-1-status-color-severity.md](phase-1-status-color-severity.md) — color/pill track the export
    gate, not mere presence: false error-red goes quiet, and a missing **statescript** becomes a
    carry-forward-driven **amber warning** (run = always expected; sleep = expected only if the animal
    has logged sleep statescripts before), never red, never a hard block. (Non-video dimensions; the
    video camera dimension is wholly owned by Phase 2.)
  - [phase-2-video-camera-repair.md](phase-2-video-camera-repair.md) — the complete video-reference
    story: correct 3-state camera signaling, an in-drawer camera selector, an **Unassigned videos**
    repair surface (camera + epoch) that closes the orphaned-video dead-end, and the bulk-generator
    phantom-camera fix.
  - [phase-3-details-modal.md](phase-3-details-modal.md) — the details panel becomes a modal sheet
    (scrim, focus trap, scroll-lock, focus-return, visible Done) — ending the click-occlusion.
  - [phase-4-filename-reconciliation.md](phase-4-filename-reconciliation.md) — reassigning a task
    surfaces + offers to re-derive its auto-named files instead of stranding a stale tag.
  - [phase-5-ia-copy-polish.md](phase-5-ia-copy-polish.md) — redundant headings, double nav, row
    density, dead camera column.
