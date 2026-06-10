# Phase 3 — Design tokens + CSS-Modules scaffolding + fix hidden logo/shortcuts (F3)

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

Lay the F6 styling foundation: extend the token set (including a **z-index scale**), stand up CSS Modules
and stylelint, and convert one shared primitive as the pattern. The z-index scale doubles as the **F3 fix** —
the lab logo and keyboard-shortcuts trigger are occluded by the nav because their container has no z-index.

**Inputs to read first:**

- [src/index.css:100-143](../../../src/index.css) — `:root` tokens (color/grey/spacing/font/transition); extended here.
- [src/index.css:26-27](../../../src/index.css) — `.primary-nav { position: relative; z-index: 1 }` (the occluding element).
- `src/App.scss:22` — `.home-region` (logo + shortcuts trigger; `position: relative`, **no z-index**); desktop `position: fixed` ~`:573`; `.skip-link { z-index: 999 }` ~`:635`.
- `src/layouts/AppLayout.jsx:248` (`.home-region`) vs `:282` (`.primary-nav`) — confirm they are DOM siblings (the stacking premise) and locate the logo `<img>` + `.shortcuts-trigger` button.
- `src/components/Modal/Modal.scss` (`.modal-overlay { z-index: 1000 }`) and `src/components/AlertModal.scss` — top of the current ad-hoc stack.

**Contracts referenced:**

- [C4 — Design-token + z-index scale + CSS-Modules conventions](shared-contracts.md#c4) — the canonical token list, the z-index scale, the migration discipline; **this phase introduces it.**

## Tasks

- **Extend `:root` tokens** in `src/index.css` per [C4](shared-contracts.md#c4): add `--color-grey-500`; `--radius-sm: 4px` / `--radius-md: 8px`; `--shadow-sm` / `--shadow-modal`; and the full `--z-*` scale.
- **Fix F3:** give `.home-region` `z-index: var(--z-banner)` (it already establishes a stacking context via `position`), and rewrite the touched magic numbers to the scale: `.primary-nav` `z-index: 1`→`var(--z-base)` (`index.css:27`), `.modal-overlay` `1000`→`var(--z-modal)` (Modal.scss), `.skip-link` `999`→`var(--z-skip-link)` (App.scss `:635`). Leave untouched magic numbers for later phases (note them; don't sweep here).
- **Browser-verify the fix** (per the layout-debug rule — don't trust CSS reading alone): with `npm run start`, use Playwright to confirm the logo and `.shortcuts-trigger` are **not** covered by `.primary-nav` (compare bounding boxes / `elementFromPoint`) at a desktop width (≥750px) and a narrow width, and that clicking the shortcuts trigger opens the modal. Encode this as the committed e2e assertion.
- **Add stylelint:** dev-deps `stylelint` + `stylelint-config-standard-scss` + a token-enforcement plugin (`scale-unlimited/declaration-strict-value` or similar); `.stylelintrc.json`; script `"lint:css": "stylelint \"src/**/*.{css,scss}\""`; a CI step. Minimal viable rules: enforce tokens on `z-index`, `color`, `background-color`. Start **warn-level** (Phase 9 ratchets to error). Don't over-invest in exhaustive rules here.
- **Stand up CSS Modules with one shared primitive:** create a canonical token-driven `Button` (`src/components/ui/Button.jsx` + `Button.module.css`) replacing the divergent `.button-*` colors with `var(--color-primary|error)` + `var(--radius-sm)`; migrate **1–2 call sites** as the proof of pattern. Establishes the `import styles from './X.module.css'` convention; full dedup is incremental (Phase 9 + as-touched).
- **Documentation:** a "Styling" section in `CLAUDE.md` (token scale, z-index scale, CSS-Modules convention, migrate-as-you-touch rule). CHANGELOG entry for the F3 fix.

## Deliberately not in this phase

- Converting all components to CSS Modules or deduping all 6 `.button-*` copies — incremental; Phase 9 + as-touched.
- Making stylelint **error-level** / sweeping all raw-hex — ratcheted in Phase 9 with the build-gate re-arm.
- Touching the frozen legacy stylesheets beyond the shared token references they already resolve.

## Validation slice

| Test | Asserts |
| --- | --- |
| `e2e/` F3 spec (Playwright) | at ≥750px and narrow, logo + `.shortcuts-trigger` are not occluded by `.primary-nav`; clicking the trigger opens the modal. |
| `npm run lint:css` | stylelint runs and passes at warn-level (no new errors). |
| `npm run typecheck` + `npx vitest run` | green — no regressions from the Button extraction. |
| `npx vitest run baselines` | byte-identical (no JS export change). |
| visual smoke (MCP or e2e screenshot) | tokens resolve; Button renders with the primary token color. |

## Fixtures

Playwright drives `npm run start` at `http://localhost:3000` (localhost only). No new data fixtures.

## Review

Before opening the PR, dispatch `code-reviewer` against the diff. Confirm:
- The z-index scale exists in `:root`; `.home-region` now sits above `.primary-nav`; F3 is **browser-verified**, not just CSS-edited.
- Touched z-index/shadow/radius use tokens; untouched legacy magic numbers noted, not half-swept.
- stylelint + CSS-Modules convention in place with one real migrated primitive; migrate-as-you-touch documented.
- Baselines byte-identical; names don't reference this plan; CLAUDE.md + CHANGELOG updated.
