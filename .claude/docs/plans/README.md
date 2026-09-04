# Plans index

Every phased plan for the `modern` branch lives in a directory here. **This file is the index; each
plan's own `PLAN.md` carries the detail.**

> These plans exist on the `modern` branch only — `.claude/docs/plans/` is empty on `main`.

## Status discipline (read before editing any plan)

Plans are written for a fresh session with zero context. A wrong `**Status:**` header is therefore not
cosmetic: it is the single line most likely to make a reader re-plan or re-execute finished work. In
September 2026 an audit found three of nine headers contradicting git history, two of them claiming
"Not started" for plans that had shipped in full months earlier.

The rule that prevents it:

1. **A phase is not done until its `PLAN.md` Status line says so — in the same commit that lands the
   phase**, not a follow-up. If you are writing the phase's merge commit, you are editing the header.
2. **State evidence, not adjectives.** Cite the commit(s) or branch a phase landed in, so a reader can
   check the claim in seconds instead of trusting it. `COMPLETE — merged 2026-06-17, P1 6902c383 …`
   beats `Done ✅`.
3. **Update this index in the same commit.** One line per plan, so the roster can be read without
   opening nine files.
4. **When a header and git disagree, git wins** — fix the header, and say in the commit message what
   it had claimed.

Verifying a header cheaply:

```bash
git merge-base --is-ancestor <phase-branch> modern && echo MERGED   # did a phase branch land?
git log --oneline modern --grep '<phase keyword>'                   # what commits claim the phase
```

## Roster

_Verified against `modern` on 2026-09-04._

| Plan | Status |
|---|---|
| [css-modules-modern-app](css-modules-modern-app/PLAN.md) | **Complete** — modern app on colocated CSS Modules + tokens; stylelint errors on `*.module.*` |
| [design-feedback-remediation](design-feedback-remediation/PLAN.md) | Phases 1–7, 8A-1–8A-3, 8B, 8C, **9 complete**; **10 / 10B open**; 11–12 are product decisions, not implementation phases |
| [dio-per-day-sets](dio-per-day-sets/PLAN.md) | Phase 1 complete; **phases 2a–4 open** |
| [epoch-editor](epoch-editor/PLAN.md) | **Complete** — phases 0–8, merged 2026-06-16→17 |
| [scope-tiers-ia](scope-tiers-ia/design-note.md) | Design note + mockups only — **no implementation plan, not scheduled** |
| [tasks-files-ux-fixes](tasks-files-ux-fixes/PLAN.md) | **Not started** — 5 phases, written 2026-06-19. Contains a data-integrity fix, not only UX |
| [trodesconf-import](trodesconf-import/PLAN.md) | **Not started** — 6 phases, written 2026-06-19 |
| [v3-review-fixes](v3-review-fixes/PLAN.md) | **Complete** — all 15 phases, merged 2026-06-17 |
| [vite-migration](vite-migration/PLAN.md) | **Complete** — `vite` is the build tool (`package.json` `start`/`build`, `vite.config.ts`) |
| [workflow-view-models](workflow-view-models/PLAN.md) | **Complete** — phases 0–5 plus post-phase-5 review follow-ups |

The retired `v3-workspace-cutover/` plan was pruned in `688f9338` once implemented; references to that
path are dead.

## Cross-cutting invariant

Every phase of every plan holds exported-YAML **byte-identity**: `npm run test:baseline` stays green.
A baseline diff means the change altered output for equivalent input and is wrong until proven a
deliberate, coordinated schema change.
