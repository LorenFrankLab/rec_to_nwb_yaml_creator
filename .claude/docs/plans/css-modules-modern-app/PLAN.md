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

**Phase 3 (app shell / navigation) — COMPLETE** (merge `f3b1db5`; branch `css-phase3-app-shell-nav` kept).
Three colocated CSS Modules, one branch / three commits / one gate:
- **AnimalSwitcher** (`a892354`): `AnimalSwitcher.css` → `AnimalSwitcher.module.css` (self-contained; the
  unstyled `animal-switcher-current` marker dropped).
- **AnimalView section-nav** (`0119dd4`): the grouped LEFT nav extracted from the global `AnimalView.css`
  into a colocated `SectionNav.module.css`. Verified-safe because the Day Editor stepper mirrors the
  `section-nav-*` class NAMES but ships its own self-contained rules scoped under `.day-editor-body`
  (DayEditor.scss) and renders literal classes — every `.section-nav*` integration test queries the Day
  Editor, so hashing the AnimalView-only names left them green. The `.animal-view-body` grid + the rest of
  AnimalView.css stay global for the Phase 4 page-area pass.
- **AppLayout app-shell** (`8d46e9f`): app-bar / primary-nav / load-notice moved from the global `index.css`
  into a colocated `AppLayout.module.css`. **Frozen-App.scss cross-file contract preserved:** the nav keeps
  its literal `primary-nav` hook class alongside scoped `styles.primaryNav` so the App.scss
  `body:has(.primary-nav) .home-region` banner rule still matches; `.home-region` (App.scss) and
  `.shortcuts-trigger` (ShortcutsHelp.scss) stay literal global and are targeted from the bar via
  `:global(...)` (verified in the bundle as `._appBar_… .home-region{margin:0}`); `skip-link` /
  `visually-hidden` also stay global. index.css now holds only `:root` tokens + the sr-only utility.

Gate: typecheck clean, lint:ci exit 0, vite build OK, 4790 vitest pass, Playwright spot-check visually
identical on all three surfaces (workspace app-bar, animal-view section-nav + AnimalSwitcher trigger/popup).
NOTE: extracting app-shell ownership necessarily made a *subtractive* edit to index.css (removing the
component rules); Phase 1 still owns the *additive* globals lockdown (tokens/reset/base-type/focus/max-width).

**Phase 1 (globals lockdown) — COMPLETE** (merge `3887f59`; branch `css-phase1-globals` kept). Added the
app-level base globals to `index.css` (the only phase that ADDS to it; Phase 3 had already made the
*subtractive* app-shell extraction):
- **Friction G — base links:** `a { color: var(--color-primary) }`. The frozen App.scss `a {}` sets
  text-decoration/margin but no colour, so bare links (the footer) fell back to browser-default bright
  blue. Maintainer chose app-wide (tints the legacy footer too — cosmetic). Component links keep their
  own class colours.
- **Friction A/B — focus discipline:** `main#main-content:focus { outline: none }`. KEY FINDING: the page
  `<main>` (tabindex=-1, focused programmatically on route change for SR announcement) is treated as
  `:focus-visible` by Chromium, so `:not(:focus-visible)` can't gate it (the first attempt left the box).
  Since `main` is never in the Tab order it's only ever focused programmatically → suppress its focus box
  unconditionally. Removed the jarring full-page blue box AND the blue/teal inconsistency (B). Interactive
  controls + the AnimalView panel keep their own `:focus-visible` rings.
- **Friction C — max-width container:** `main#main-content:not(.day-editor-content) { max-width: 1280px;
  margin-inline: auto }`. Maintainer chose 1280px, modern-only. Modern views render a `<main>` (legacy
  uses a `<div>`, untouched); the Day Editor already manages its own 1200px (`.day-editor-content`, kept
  via the `:not()` exclusion). App-bar + footer stay full-width by design.

Verified in-browser (Playwright + getComputedStyle): footer link `#1565c0`; main `outline-style:none`
while focused; modern mains 1280 centered, DayEditor 1200, legacy `<div>` uncapped + form renders. Gate:
typecheck clean, lint:ci exit 0, vite build OK, 4790 vitest.

**Phase 4 (page areas) — IN PROGRESS.**
- **DONE — AnimalView page area** (merge `bd005ad`; branch `css-phase4-animalview` kept):
  `ConfigVersionContext.css` → module (`41c128c`); `AnimalView.css` rest → `AnimalView.module.css`
  (`dd2a751`). `repair-target-highlight` is a JS-applied (`classList.add`) literal class SHARED with the
  Day Editor → kept GLOBAL via `:global([data-field-path].repair-target-highlight)` (verified global in
  bundle). The saveIndicator test's `.animal-view-header` scope query decoupled to a `data-testid`.
- **DONE — ImportYamlDialog** (merge `3aedc33`; branch `css-phase4-importyaml` kept; commit `38b9a02`):
  `ImportYamlDialog.css` → `ImportYamlDialog.module.css` (all `import-*` → single-word scoped names,
  values verbatim). Shared `btn-primary`/`btn-secondary` (AnimalWorkspace.css) kept literal global; the
  two unstyled marker classes `import-preview`/`import-result` dropped (aria-labels retained). Recon
  CONFIRMED-SAFE held: no cross-file or test references to `import-*`. Verified the class map 1:1 (every
  `styles.X` resolves to a module rule) + Playwright PICK-phase visual identical.
- **REMAINING Phase 4 (next session):** Home, AnimalWorkspace, setup tables (E), DayEditor Breadcrumb +
  IssueOwnershipHint, ValidationSummary (H), CalendarDayCreator.

**Recon map for the remaining files (read before migrating — these are the section-nav-style hazards).**
Classes that MUST stay GLOBAL (literal, shared across files / JS-applied / queried by tests — do NOT hash;
use `:global()` if the rule must live in a module):
- `error-state*` (ErrorState.css — shared utility, already known).
- `status-chip` + variants — shared by AnimalWorkspace.css, ValidationSummary.css, DayEditor.scss (each
  scopes its own variants). A test queries `.status-chip` / `.day-row-status` / `.day-session-desc` in
  `RecordingDaysTab.dayRow.test.jsx`.
- `btn-primary` / `btn-secondary` (AnimalWorkspace.css) and `button-primary` / `button-secondary` /
  `table-actions` / `status-badge*` / `section-header` (the AnimalEditor setup tables) — shared across
  DayEditor + components + all four setup tables. The four setup tables (`CamerasSection.scss`,
  `ElectrodeGroupsStep.scss`, `TaskTypesSection.scss`, `DataAcqSection.scss`) are ENTANGLED on these — a
  clean module migration needs all four done together with `:global()` for the shared names. **For friction
  E it is NOT necessary to module-migrate them: the truncation lives in DESCENDANT selectors**
  (`.cameras-table td:nth-child(2..5) { max-width:0; white-space:nowrap; text-overflow:ellipsis }` —
  CamerasSection.scss ~172; same pattern TaskTypesSection.scss ~41; AnimalWorkspace `.day-session-desc`
  `max-width:26rem`+nowrap) — **fix the truncation IN PLACE** (the `max-width:0` + `table-layout:fixed`
  combo is what truncates "despite ample width") without hashing the shared classes.
- `visually-hidden` (global utility), `empty-state` (used as scoped `.cameras-section.empty-state` etc.).
Confirmed COLOCATED-SAFE (no shared classes per recon): `ImportYamlDialog.css` (all `import-*`; btn-* are
NOT redefined, only referenced), `AnimalView.css` (done). Friction **H** (disclosure bars): ValidationSummary's
`<details>` bars carry only `cursor:pointer` — the inconsistent height/border comes from the FROZEN App.scss
global `details { border:1px solid black; … }` element rule that modern bars inherit; scope around it (don't
touch App.scss).

**Next:** finish Phase 4 → Phase 5 stylelint ratchet (tokenize the modules' verbatim values + z-index scale,
then ratchet `*.module.*` to error).

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
