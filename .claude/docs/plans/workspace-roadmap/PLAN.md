# Workspace Enhancements Roadmap

**Status:** Not started.

One-paragraph summary: the post-merge workspace roadmap — data-entry efficiency wins, the channel-maps split, a YAML importer, and the hybrid tabbed Day Editor — sequenced by export-merge risk. Each phase ships as an independent PR. The decision-gated work (task catalog, dataset tier, cutover) is parked in [overview.md](overview.md) as open questions, not detailed, because their designs aren't settled.

Read [overview.md](overview.md) first for cross-phase context (goals, non-goals, integration points, the merge-seam risk policy, risks, open questions). Shared helper/contract signatures used by ≥2 phases live in [shared-contracts.md](shared-contracts.md).

## Reading order

1. [overview.md](overview.md) — why, scope, integration points, risk policy, gated items.
2. [shared-contracts.md](shared-contracts.md) — carry-forward helper + `decomposeYaml` contracts (phases 1/5 and 6a/6b).
3. The phase you're executing (below).

## Phases (each an independent PR; ordered by merge-seam risk)

| Phase | File | Merge risk |
| --- | --- | --- |
| 1 | [phase-1-carry-forward.md](phase-1-carry-forward.md) | 🟢 neutral |
| 2 | [phase-2-duplicate-day.md](phase-2-duplicate-day.md) | 🟢 neutral |
| 3 | [phase-3-copy-from-animal.md](phase-3-copy-from-animal.md) | 🟢 neutral |
| 4 | [phase-4-cameras-used.md](phase-4-cameras-used.md) | 🟢 neutral (additive; baselines unmoved) |
| 5 | [phase-5-channel-maps-split.md](phase-5-channel-maps-split.md) | 🟡 merge-changing + migration |
| 6a | [phase-6a-import-decompose.md](phase-6a-import-decompose.md) | 🟢 (round-trip parity) |
| 6b | [phase-6b-import-reconcile-ui.md](phase-6b-import-reconcile-ui.md) | 🟢 |
| 7 | [phase-7-hybrid-day-editor.md](phase-7-hybrid-day-editor.md) | 🟢 UI only |

Suggested execution order: 1 → 2 → 3 → 4 → 6a → 6b → 5 → 7. (Efficiency wins first; the importer next as it unblocks the held cutover; the merge-changing split after; the editor refactor last.)
