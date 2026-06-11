# Phase 8A — Pre-test UX hardening index

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

This is a coordination index, not a Claude-Code execution prompt.

The original pre-test UX hardening work was intentionally split after review because it mixed too many
representation, accessibility, copy, and responsive-layout decisions into one PR. Run these smaller prompts
in order so each change has a legible evaluation question:

1. [Phase 8A-1 — Timeline + lifecycle hardening](phase-8a1-timeline-lifecycle-hardening.md)
2. [Phase 8A-2 — Recognition + accessibility hardening](phase-8a2-recognition-accessibility-hardening.md)
3. [Phase 8A-3 — Responsive + copy hardening](phase-8a3-responsive-copy-hardening.md)

All three are merge-neutral pre-testing phases:

- No Workspace default route or legacy cutover.
- No persisted-schema bump.
- No exported YAML change; `npx vitest run baselines` must stay byte-identical.
- Each phase should be reviewable as its own PR.

After 8A-1 through 8A-3, continue with [Phase 8B](phase-8b-task-type-catalog-model.md) and
[Phase 8C](phase-8c-task-type-catalog-ui.md).
