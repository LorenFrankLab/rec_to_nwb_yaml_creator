# CSS architecture for the modern TSX app

**Goal:** give the **live (modern) TSX surfaces** a clean, scoped CSS architecture (CSS Modules +
design tokens), migrating ownership component-by-component. **Not** "clean all CSS everywhere."

**Guardrails (from the track brief):**
- **Modern-app-only.** The frozen legacy single-page form (slated for deletion) gets **no** CSS effort —
  its styles are quarantined until the form is deleted.
- **Ownership first, then ratchet.** Do NOT ratchet all stylelint to error yet. Migrate ownership →
  ratchet `*.module.css` to error → leave old global/legacy CSS on warning (or excluded) until deletion.
- **Keep globals small:** `:root` tokens, reset/base typography, app-level layout primitives, focus
  styles. Everything else becomes a component module.

## Current state (verified)
- **CSS Modules already done (2):** `components/ui/Button.module.css`, `components/DayLifecycleLegend/`.
- **Live global `.css` to migrate (17):** `index.css` is the global tokens/base (STAYS global); the rest
  are component/page styles —
  - components: `AnimalDeleteDialog`, `AnimalProfileDialog`, `AnimalSwitcher`, `OverflowMenu`,
    `ReconfigurationContextBanner`, `WarningAcknowledgement`, `ErrorBoundary`, `ErrorState`,
    `CalendarDayCreator/CalendarDayCreator`
  - pages: `AnimalView/AnimalView`, `AnimalView/ConfigVersionContext`, `AnimalWorkspace/AnimalWorkspace`,
    `AnimalWorkspace/ImportYamlDialog`, `DayEditor/Breadcrumb`, `DayEditor/IssueOwnershipHint`,
    `Home/Home`, `ValidationSummary/ValidationSummary`
- Tokens (`--color-*`, `--spacing-*`, z-index scale, etc.) already live in `index.css :root`; `stylelint`
  runs at **warn** level today (token enforcement on `z-index`/`color`/`background-color`).
- No legacy-form `.css` in the live set — the live surfaces ARE the whole job.

## Verification pass — UI friction found (note only; do not fix before migrating ownership)
A short drive of workspace → animal view → cameras setup (table + modal) → validation/export. Default
workflows **work**; the friction is polish/consistency, and it maps onto the buckets below:

| # | Friction | Surface(s) | Bucket |
| --- | --- | --- | --- |
| A | Prominent **blue focus-box** around the whole `<main>` on route-change focus (browser-default ring on a programmatically-focused `tabindex=-1` main — no `:focus-visible` discipline) | AnimalView days, Validation | globals: focus styles |
| B | Panel **border color inconsistent** (blue on days/validation vs teal on cameras) | AnimalView panels | globals: tokens / focus |
| C | Content is **full-width edge-to-edge** (cards + tables stretch; no max content width) | Workspace, tables | globals: layout primitives |
| D | **Destructive `Delete` buttons are heavy red fills** in every table row (over-weighted) | Cameras, tables | primitive: Button (destructive variant) |
| E | **Premature text truncation** in tables ("overhead\_c…", "Fujinon HF1…") despite ample width | Cameras (and likely other setup tables) | page area: tables |
| F | **Modal too tall** — footer near the viewport clip (no max-height + scroll body + sticky footer); **empty required inputs show red/pink borders before interaction** (premature invalid styling) | Add Camera modal (shared Modal) | primitive: Modal + form inputs |
| G | **Footer links are default bright-blue underline** (unstyled) | every page | globals: base typography/links |
| H | Disclosure bars ("What gets exported?" / "What do these statuses mean?") have **inconsistent heights/styling** | Validation, AnimalView | page area / primitive |

(These are CSS-architecture targets, not blockers — the app is functional. Several are design calls the
maintainer should confirm: de-weighting `Delete`, adding a max-width layout, the focus-ring treatment.)

## Status (CSS track — merged into `modern`, not pushed)
Done so far (each a branch → full gate → `--no-ff` merge): OverflowMenu, WarningAcknowledgement,
ReconfigurationContextBanner (→ CSS Modules); modal `:user-invalid` premature-invalid fix.

**Friction F (Modal) — COMPLETE.** Modal ownership → `Modal.module.scss` (`e3eb8f7`); backward-compatible
`footer` sticky-footer slot + ConfirmDialog (`79601af`); then the sticky footer migrated across **every
live Modal consumer**: CameraModal (`62db840`), ElectrodeGroupModal (`8fc99b9`), TaskType+TaskInstance
(`5ac1542`), AnimalDelete/AnimalProfile/CopyFromAnimal (`5c11217`), Shortcuts/CameraReference/DuplicateDay/
Calendar/DataAcq/Alert (`3e17c71`), and the two wizards ImportYamlDialog + ReconfigWizard (`bfcbf9e`).
`TaskModal.tsx` is test-only/unused in the live app → intentionally skipped. Two patterns proved & reused:
(1) **form-relocation** for stateful `*Form` modals (move `<Modal>` into the form so `footer` reaches form
state; wrapper renders `isOpen ? <Form/> : null`); (2) **submit→button** when an action lives in a `<form>`
(`type="submit"` → `type="button" onClick`, form's onSubmit still handles Enter). Multi-phase
ImportYamlDialog hoists a per-phase `footer` to the top-level Modal and drops each sub-phase's action row.

**Friction D (Button restrained-destructive) — COMPLETE** (`39c3d85`). The Button primitive gained
token-driven `dangerSubtle` (restrained red-text) + `neutral` (quiet grey) variants and a `small` size
(`c3f64d7`); every live table's row Edit/Delete (+ ↑/↓ reorder / Remove) migrated to `<Button>` so the
app reads quiet instead of a wall of filled red — Cameras (`40aeb7c`), then ElectrodeGroups/TaskTypes/
DataAcq/TasksTable/TaskInstances/AssociatedFiles/AssociatedVideos/TaskEpochs (`cfa7e34`). Per-section
recipe: trim each in-cell `… tbody tr td button` element selector (it set `border:none`+padding at
specificity 0,1,4 and would override the primitive) down to just gap + WCAG touch target; remove the dead
`.button-small`/`.button-danger` color rules; retarget responsive + print rules to the element selector.
`TaskModal.tsx` keeps the legacy classes (test-only/unused). The filled `danger` is reserved for the
confirm dialog.

**SaveIndicator → CSS Module — DONE** (`e908fe5`): `.save-indicator*` moved out of the global DayEditor.scss
into a colocated `SaveIndicator.module.css` (it renders in both the Day Editor stepper and the AnimalView
header, so it now carries its own styling); unstyled decorative classes dropped. **This completes Phase 2
(shared UI primitives):** Modal, Button (+ friction D), OverflowMenu, banners, SaveIndicator all on CSS
Modules.

**Next:** Phase 3 app-shell/nav (`AnimalSwitcher` + AppLayout app-bar/primary-nav/section-nav — the
section-nav styles currently live in AnimalView.css) → Phase 4 page areas → Phase 1 globals
(focus-ring/max-width/links) → Phase 5 stylelint ratchet (tokenize the modules' verbatim values + z-index
scale, then ratchet `*.module.*` to error).

## Phased order
Each phase: migrate the component's styles into a colocated `*.module.css`, reference via
`className={styles.x}`, delete the old global file, verify (typecheck · full vitest · `vite build` ·
targeted e2e/visual), then move on. No behavior/markup change beyond class wiring.

### Phase 1 — Globals (small) + the cross-cutting friction
- Lock `index.css` to: `:root` tokens, reset/base typography (fixes **G**), app-level layout primitives
  incl. a max-width content container (fixes **C**), and a `:focus-visible` focus-ring discipline so
  programmatic route-focus stops drawing the full-page box (fixes **A/B**).
- This is the only phase that touches globals; keep it lean.

### Phase 2 — Shared UI primitives (live components)
Buttons (already a module — add/verify a restrained **destructive** variant for **D**), the shared
**Modal** (max-height + scroll body + sticky footer for **F**) and form-input styles (premature-invalid
for **F**), **OverflowMenu**, banners (`ReconfigurationContextBanner`, `WarningAcknowledgement`,
`ErrorState`), and the **SaveIndicator**.

### Phase 3 — App shell / navigation
`AnimalSwitcher` + the AppLayout app-bar/primary-nav + section-nav styles (currently in `AnimalView.css`).

### Phase 4 — Page areas
`Home`, `AnimalWorkspace` (+ `ImportYamlDialog`), `AnimalView` (+ `ConfigVersionContext`), `AnimalEditor`
setup tables (truncation **E**), `DayEditor` (`Breadcrumb`, `IssueOwnershipHint`, …), `ValidationSummary`
(disclosures **H**), `CalendarDayCreator`.

### Phase 5 — Ratchet
Ratchet `stylelint` to **error** for `*.module.css` only; leave any remaining global/legacy CSS on warn
or excluded until the legacy form is deleted.

## Verification per phase
`npm run typecheck` · `npx vitest run` · `vite build` · `npm run lint:css` (warn) · targeted e2e +
a Playwright visual spot-check of the touched surface (CSS refactors keep tests green while the UI
quietly shifts — screenshot-compare the before/after).
