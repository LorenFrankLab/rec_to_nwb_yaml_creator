# Phase 3 — Epoch details as a true modal sheet

[← back to PLAN.md](PLAN.md) · [overview](overview.md)

The details editor is a `position: fixed` right-docked `<aside>` at `--z-overlay` with **no scrim** and
a still-interactive page beneath — a half-modal. It physically covers the readiness bar's "Fix"
buttons (a Playwright click on "Fix video camera" was intercepted by the panel header). Finding #2.
Per the chosen direction, re-host it in the existing `Modal` primitive: a **scrim** (clicks land on the
backdrop → close, instead of being stolen by a floating panel), a **focus trap**, **body-scroll lock**,
**focus return**, and a **visible Done button**. This fixes the pointer-occlusion that motivated the
phase.

**Accuracy note (Finding #4):** `Modal` traps *focus* and blocks *pointer* via the scrim, but does
**not** set `inert`/`aria-hidden` on the background and does not portal — so the background is not truly
inert for assistive tech. This phase does not claim otherwise. Making it inert is a shared-`Modal`
change (portal + `inert`, blast radius = every dialog) tracked as a separate enhancement
([overview Open Q #3](overview.md#open-questions)); it is **out of scope here**.

**Inputs to read first:**

- [src/components/Modal/Modal.tsx](../../../../src/components/Modal/Modal.tsx) — the dialog primitive:
  `isOpen`, `onClose`, `title`, `titleId`, `closeOnOverlayClick`, `role`, `describedById`,
  `className`, optional sticky `footer`. Owns ESC, overlay-click, body-scroll lock, focus trap, and
  focus return. This is the whole engine — the phase is mostly a re-host.
- [src/pages/DayEditor/EpochsTab.tsx:1159-1438](../../../../src/pages/DayEditor/EpochsTab.tsx) —
  `EpochDetailsPanel`: the current `<aside className={styles.detailsPanel}>` with a bespoke header
  (title + meta + Close) and a body of three `<section>`s (Files / Task / Optogenetics).
- [src/pages/DayEditor/EpochsTab.tsx:554-561](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  current ad-hoc Escape handler on `EpochsTab` (remove; `Modal` owns Esc).
- [src/pages/DayEditor/EpochsTab.module.css:512-575](../../../../src/pages/DayEditor/EpochsTab.module.css)
  — `detailsPanel` (fixed), `detailsPanelHeader`, `detailsPanelBody`, `panelCloseButton`, and the
  `@media (max-width:768px)` full-screen override (`:920-926`). Most of this is replaced by `Modal`'s
  overlay/content; keep only the body layout (the three sections’ spacing).
- [src/pages/DayEditor/EpochsTab.tsx:1203-1215](../../../../src/pages/DayEditor/EpochsTab.tsx) — the
  `pendingFileFocus` effect (Phase 2's camera focus). Verify it still lands inside the modal.

## Tasks

- **Re-host the panel in `Modal`.** Replace the `<aside id={panelId} className={styles.detailsPanel}>`
  shell (`EpochsTab.tsx:1217-1232`) with `<Modal isOpen onClose={p.onClose} role="dialog"
  title={`Epoch ${row.epoch}: ${row.taskName || '(no task)'}`} titleId={`${panelId}-heading`}
  className={styles.detailsModal} footer={<Button variant="primary" onClick={p.onClose}>Done</Button>}>`.
  Render the existing header meta (`tag`, `EpochStatusPill`) and the three body `<section>`s as
  children. Drop the bespoke `panelCloseButton` (`:1229-1231`). The footer "Done" is **required** (not
  optional) — Esc + backdrop alone is too hidden for a dense data editor; `Modal`'s sticky footer keeps
  it reachable on a tall panel.
- **Remove the redundant Escape handler.** Delete the `EpochsTab` keydown effect at
  `EpochsTab.tsx:554-561`; `Modal` owns Esc → `onClose` (which is `setActiveEpoch(null)`).
- **`activeEpoch` stays the open/close source of truth.** `isOpen` is implied by rendering
  `EpochDetailsPanel` only when `activeRow` is truthy (`EpochsTab.tsx:810`); keep that — pass
  `isOpen` literal `true` since the component only mounts when open, OR mount it always and pass
  `isOpen={activeRow != null}` so `Modal` runs its focus-return cleanup. Prefer the latter (mount with
  `isOpen={!!activeRow}`) so focus returns to the row's "Details" button on close — verify the opener
  is the disclosure button.
- **CSS cleanup.** In `EpochsTab.module.css`, delete `detailsPanel`'s fixed-position block and the
  mobile full-screen override that exists only to tame the fixed panel (`:512-526`, `:920-926`);
  replace with a `detailsModal` class that only sizes the content box (`width: min(560px, …)`,
  `max-height`) and lets `Modal`'s overlay handle centering/scrim. Keep `detailsPanelBody`'s section
  spacing (rename to fit the module if needed). No raw z-index — `Modal`'s overlay already uses the
  token scale; remove the `--z-overlay` reference that's no longer needed here.
- **Repair-focus still works (cross-check with Phase 2).** The frame focus effect
  ([DayEditorFrame.tsx:243-266](../../../../src/pages/DayEditor/DayEditorFrame.tsx)) and the in-tab
  `pendingFileFocus` effect both query `data-field-path` inside the panel. Since `Modal` auto-focuses
  its first focusable on open, ensure the targeted control still ends up focused (the token-guarded
  `pendingFileFocus` runs after mount). Add a test that a repair deep-link to a video camera focuses
  the select **inside** the modal.

## Deliberately not in this phase

- Restructuring the panel's *contents* (the Files/Task/Opto sections, the `GeneratedValue` rows) —
  unchanged; this phase only swaps the container.
- Inline-accordion or two-column layouts — explicitly rejected in favor of the modal (PLAN open
  question #2).
- Touching `ConfirmDialog`/`TaskTypeModal` (already `Modal`-based) — out of scope.
- **Making the background `inert`/`aria-hidden`** — needs `createPortal` + `inert` on the shared
  `Modal` (every dialog); deferred ([overview Open Q #3](overview.md#open-questions)). This phase
  delivers scrim + focus-trap + scroll-lock, which fixes the pointer-occlusion, and describes that
  accurately.

## Validation slice

| Test | Asserts |
| --- | --- |
| `EpochsTab` — opens as dialog | Selecting a row renders an element with `role="dialog"`, `aria-modal="true"`, labelled by the epoch heading. |
| `EpochsTab` — Esc / overlay / Done close | Esc, a backdrop click, and the footer "Done" button each call `onClose`; a click inside the content does not. |
| `EpochsTab` — focus return | Closing returns focus to the "Details" disclosure that opened it. |
| `EpochsTab` — repair lands inside modal | A video-camera repair deep-link opens the modal and focuses the camera select (re-run of the Phase 2 landing test against the modal). |
| `jest-axe` | The open modal has no axe violations (focus trap, labelling). |
| `baselines` | byte-identical. |

## Fixtures

Reuse Phase 1/2 epoch fixtures. No new data; this is a container swap. If an `e2e` spec exists for the
drawer, update its selectors (the panel is now `role="dialog"`); otherwise add a jsdom test only.

## Review

Dispatch `code-reviewer` against the diff. Confirm:
- The panel is a modal (scrim + focus-trap + scroll-lock + restore-focus + visible Done) — the
  pointer-occlusion that motivated the phase is gone (backdrop clicks close, they don't get stolen).
  The phase does **not** claim AT-inert background (accurately scoped).
- The old `detailsPanel` fixed-position CSS and the redundant Esc handler are **removed**, not left
  parallel.
- Phase 2's repair-focus landing still passes against the modal.
- `baselines` byte-identical; no plan references; tokens for any z-index/color; axe clean.
