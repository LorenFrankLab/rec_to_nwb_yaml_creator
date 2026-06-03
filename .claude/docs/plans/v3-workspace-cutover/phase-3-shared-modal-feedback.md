# Phase 3 — Shared Modal primitive & feedback unification

[← back to PLAN.md](PLAN.md) · [overview](overview.md) · [shared-contracts](shared-contracts.md#modal-primitive-contract)

This phase is **tech debt paydown sequenced before the feature phases that add more modals and feedback**
(the task editor in a later phase is built on the primitive this phase creates; the export/parity work
adds more user-facing notices). The goal is a single accessible `<Modal>` used everywhere, replacement
of the blocking native `alert()`/`window.confirm()` calls with the app's in-UI feedback components, and
collapse of the duplicated device-type list down to one source of truth. This is a **behavior-preserving
refactor**: no modal field, validation, or save behavior changes.

**Inputs to read first:**

- [src/pages/AnimalEditor/CameraModal.jsx:152-209](../../../../src/pages/AnimalEditor/CameraModal.jsx) —
  the **working** dialog infrastructure to port: ESC + focus-trap keydown handler (`:152-182`), focus
  first field (`:184-189`), body-scroll lock (`:191-202`), overlay-click close (`:204-209`). Note the
  init effect (`:60-84`) is keyed on the unstable `existingCameras` array prop — it resets the form
  whenever that array identity changes, which is the anti-pattern the contract forbids.
- [src/pages/AnimalEditor/ElectrodeGroupModal.jsx:135-174](../../../../src/pages/AnimalEditor/ElectrodeGroupModal.jsx) —
  the **inferior** copy: ESC-only handler with **no focus trap and no focus return** (`:135-147`),
  duplicated scroll-lock (`:156-167`) and overlay handler (`:169-174`); hardcoded `DEVICE_TYPES`
  (`:40-52`); init effect keyed on `[mode, group, isOpen]` (`:67-90`).
- [src/components/AlertModal.jsx:26-133](../../../../src/components/AlertModal.jsx) — existing component.
  API: `{ isOpen, message, title='Alert', onClose, type='info'|'success'|'warning'|'error' }`,
  `role="alertdialog"`, ESC + overlay close, scroll-lock, auto-focus close button. **No focus trap and
  no focus return today** — it has the same gaps. Reuse it for success/error replacement; back it onto
  the shared primitive so it inherits the trap/return.
- [src/components/AlertModal.scss](../../../../src/components/AlertModal.scss) — existing styles (icon
  map, type variants) to keep visually intact.
- alert()/confirm() call sites (all verified):
  - [AnimalEditorStepper.jsx:112](../../../../src/pages/AnimalEditor/AnimalEditorStepper.jsx) (success),
    `:116` (success), `:215` (success), `:234` (**confirm**, delete electrode group, `:230-236`),
    `:299` (success), `:358` (info/empty), `:396` (error block, `:393-408`), `:410` (success),
    `:412` (error).
  - [ChannelMapEditor.jsx:82](../../../../src/pages/AnimalEditor/ChannelMapEditor.jsx) (error, `:77-87`).
  - [CalendarDayCreator.jsx:184](../../../../src/components/CalendarDayCreator/CalendarDayCreator.jsx) (error, `:182-185`).
  - [BehavioralEventsSection.jsx:134](../../../../src/pages/AnimalEditor/BehavioralEventsSection.jsx) (**confirm**, delete event, `:132-142`).
- [src/valueList.js:839-856](../../../../src/valueList.js) — `deviceTypes()`, the canonical list. **It
  already differs from the modal's hardcoded copy:** it includes `128c-4s8mm6cm-15um-26um-sl` (`:845`)
  which the modal omits, and the two lists are in different orders. Switching the modal to this source
  is a deliberate correction — see "Validation slice" for the assertion that pins parity.
- [src/ntrode/deviceTypes.js:7,92](../../../../src/ntrode/deviceTypes.js) — `deviceTypeMap()` /
  `getShankCount()`, the channel-config source. The dropdown's display list comes from `valueList.js`;
  `deviceTypes.js` is the per-type channel-geometry source. The modal needs the **display list**, so it
  imports `deviceTypes()` from `valueList.js`.
- [src/pages/AnimalEditor/DataAcqSection.jsx:17,53-72](../../../../src/pages/AnimalEditor/DataAcqSection.jsx) —
  docstring claims "Debounced save on blur" (`:17`) and the handler comment says "save to parent with
  debounce" (`:53`), but `handleBlur` (`:57-72`) writes synchronously with no debounce. Misleading docs.
- [src/pages/AnimalEditor/__tests__/CameraModal.test.jsx](../../../../src/pages/AnimalEditor/__tests__/CameraModal.test.jsx),
  [ElectrodeGroupModal.test.jsx](../../../../src/pages/AnimalEditor/__tests__/ElectrodeGroupModal.test.jsx),
  [src/components/__tests__/AlertModal.test.jsx](../../../../src/components/__tests__/AlertModal.test.jsx) —
  existing field/validation/close tests that MUST keep passing after migration. Runner is **Vitest**
  (`package.json:65`, `vitest.config.js`); mocks use `vi.fn()`.

**Contracts referenced:**

- [`<Modal>` primitive contract](shared-contracts.md#modal-primitive-contract) — this phase **creates**
  the primitive and migrates the two existing modals onto it. Honor every clause: `role="dialog"`,
  `aria-modal="true"`, labelled title, ESC close, configurable overlay-click close, body-scroll lock,
  focus trap (ported from CameraModal), focus return to opener, init-by-stable-key (remount on open, not
  an effect keyed on an unstable array prop). Do not weaken.
- [YAML parity / shadow-export contract](shared-contracts.md#yaml-parity--shadow-export-contract) — the
  golden baselines must stay byte-identical. This phase touches no export path, but the device-type list
  change must not alter any persisted/exported value, so the baselines are a guardrail here too.

## Tasks

- **Create the shared primitive** `src/components/Modal/Modal.jsx` + `src/components/Modal/Modal.scss`
  (plus a barrel `src/components/Modal/index.js` re-exporting `Modal` and `ConfirmDialog`). `Modal` owns
  all dialog accessibility so callers supply only `titleId`/`title`/children/footer. Port CameraModal's
  keydown handler verbatim (the only working focus trap in the codebase). Implement focus-return by
  capturing `document.activeElement` on open and restoring it on unmount/close. Satisfy
  init-by-stable-key by **not rendering children when closed** (the caller remounts content on open via
  React's natural unmount, eliminating the unstable-dep init effect). Complete code:

  ```jsx
  // src/components/Modal/Modal.jsx
  import React, { useEffect, useRef } from 'react';
  import PropTypes from 'prop-types';
  import './Modal.scss';

  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /**
   * Accessible dialog container. Owns ESC close, overlay-click close (optional),
   * body-scroll lock, focus trap, and focus return to the element that opened it.
   * Callers render their own form/content as children and pass a stable titleId.
   *
   * @param {object} props
   * @param {boolean} props.isOpen Whether the dialog is shown.
   * @param {Function} props.onClose Called for ESC / overlay / programmatic close.
   * @param {string} props.title Heading text rendered as the labelled title.
   * @param {string} props.titleId id wired to aria-labelledby and the heading.
   * @param {boolean} [props.closeOnOverlayClick=true] Close when the backdrop is clicked.
   * @param {('dialog'|'alertdialog')} [props.role='dialog'] ARIA role.
   * @param {string} [props.describedById] Optional aria-describedby target id.
   * @param {string} [props.className] Extra class on the content box.
   * @param {React.ReactNode} props.children Dialog body.
   */
  const Modal = ({
    isOpen,
    onClose,
    title,
    titleId,
    closeOnOverlayClick = true,
    role = 'dialog',
    describedById,
    className = '',
    children,
  }) => {
    const contentRef = useRef(null);
    const openerRef = useRef(null);

    // Capture the opener and restore focus to it on close.
    useEffect(() => {
      if (!isOpen) return undefined;
      openerRef.current = document.activeElement;
      return () => {
        if (openerRef.current && typeof openerRef.current.focus === 'function') {
          openerRef.current.focus();
        }
      };
    }, [isOpen]);

    // ESC close + focus trap (ported from the working CameraModal implementation).
    useEffect(() => {
      if (!isOpen) return undefined;
      const handleKeydown = (e) => {
        if (e.key === 'Escape') {
          onClose();
          return;
        }
        if (e.key === 'Tab' && contentRef.current) {
          const focusable = contentRef.current.querySelectorAll(FOCUSABLE);
          if (focusable.length === 0) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener('keydown', handleKeydown);
      return () => document.removeEventListener('keydown', handleKeydown);
    }, [isOpen, onClose]);

    // Auto-focus the first focusable element when opened.
    useEffect(() => {
      if (!isOpen || !contentRef.current) return;
      const focusable = contentRef.current.querySelector(FOCUSABLE);
      if (focusable) focusable.focus();
    }, [isOpen]);

    // Lock body scroll while open.
    useEffect(() => {
      if (isOpen) document.body.style.overflow = 'hidden';
      else document.body.style.overflow = '';
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleOverlayClick = (e) => {
      if (closeOnOverlayClick && e.target.classList.contains('modal-overlay')) {
        onClose();
      }
    };

    return (
      <div className="modal-overlay" onClick={handleOverlayClick} role="presentation">
        <div
          ref={contentRef}
          className={`modal-content ${className}`.trim()}
          role={role}
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={describedById}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id={titleId} className="modal-title">
            {title}
          </h2>
          {children}
        </div>
      </div>
    );
  };

  Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.node.isRequired,
    titleId: PropTypes.string.isRequired,
    closeOnOverlayClick: PropTypes.bool,
    role: PropTypes.oneOf(['dialog', 'alertdialog']),
    describedById: PropTypes.string,
    className: PropTypes.string,
    children: PropTypes.node.isRequired,
  };

  export default Modal;
  ```

  `Modal.scss` carries the shared overlay/content/title/`form-actions`/`btn-cancel`/`btn-save` rules
  currently duplicated across `CameraModal.scss` and `ElectrodeGroupModal.scss` (centering, backdrop,
  max-width, padding). Keep the existing visual result; the two bespoke `.scss` files are reduced to
  modal-specific tweaks (form layout, coordinate grid) or deleted if fully subsumed.

- **Migrate `CameraModal`** onto `Modal`. Delete its keydown/ESC/trap effect (`:152-182`), the
  first-field-focus effect (`:184-189`), the scroll-lock effect (`:191-202`), the overlay handler
  (`:204-209`), and the `modalRef`. Wrap the existing `<form>` in `<Modal isOpen={isOpen}
  onClose={onCancel} title={title} titleId="camera-modal-title">`. **Fix the unstable init effect**
  (`:60-84`): because `Modal` returns `null` when closed, lift the form into a child component that
  `Modal` only renders when open, initializing form state from props once at mount (drop `existingCameras`
  and `isOpen` from the effect deps, or compute initial state directly in `useState`). Keep
  `firstFieldRef` only if still needed for field ordering; otherwise rely on `Modal`'s auto-focus.
  Preserve all field/validation/save behavior exactly.

- **Migrate `ElectrodeGroupModal`** onto `Modal` identically — delete its ESC-only effect (`:135-147`),
  scroll-lock (`:156-167`), overlay handler (`:169-174`), and stabilize the init effect (`:67-90`). This
  migration **adds the focus trap and focus return it never had**, resolving the CameraModal/
  ElectrodeGroupModal inconsistency. Preserve `BrainRegionAutocomplete`, the add-mode `count` field, and
  all save/validation behavior.

- **Add `ConfirmDialog`** at `src/components/Modal/ConfirmDialog.jsx` (+ re-export from the barrel),
  built on `Modal` with `role="dialog"`, a message body, and Cancel / Confirm buttons. Suggested API:
  `{ isOpen, title, message, confirmLabel='Confirm', cancelLabel='Cancel', destructive=false, onConfirm,
  onCancel }`. Replace the two destructive `window.confirm()` prompts:
  - `AnimalEditorStepper.jsx:234` (delete electrode group, `:230-236`) — drive a `ConfirmDialog` via
    local state (`pendingDelete`), moving the existing removal logic (`:238` onward) into `onConfirm`.
  - `BehavioralEventsSection.jsx:134` (delete behavioral event, `:132-142`) — same pattern; move the
    filter+`onFieldUpdate('behavioral_events', …)` into `onConfirm`.

- **Replace all `alert()`** success/info/error calls with `AlertModal` (rebased on `Modal`) or inline
  feedback — non-blocking and accessible. Convert each call site to set local message/type state that
  renders an `<AlertModal>`; for the success cases that also navigate (`AnimalEditorStepper.jsx:112/116`,
  which set `window.location.hash`), perform the navigation in the AlertModal's `onClose`/Continue
  handler so the user sees the message first. Sites to convert:
  `AnimalEditorStepper.jsx:112,116,215,299,358,396,410,412`, `ChannelMapEditor.jsx:82`,
  `CalendarDayCreator.jsx:184`. (The `:234` confirm in AnimalEditorStepper is handled by ConfirmDialog
  above.) **Note:** `src/pages/LegacyFormView.jsx:234` (`window.confirm`) is intentionally **left
  unchanged** — see "Deliberately not in this phase."

- **Rebase `AlertModal` onto `Modal`** so it inherits the focus trap and focus return it currently lacks
  (`AlertModal.jsx:26-133` has neither). Render its content (icon + message + Close button) as `Modal`
  children with `role="alertdialog"` and `describedById="alert-modal-message"`. Keep the public
  AlertModal props and `AlertModal.scss` visuals unchanged so existing `AlertModal.test.jsx` passes.

- **Device-type single source.** In `ElectrodeGroupModal.jsx` delete the hardcoded `DEVICE_TYPES`
  (`:40-52`) and `import { deviceTypes } from '../../valueList';`, using `deviceTypes()` to populate the
  dropdown (`:213-217`). This corrects the modal's list to match the canonical 12-entry list (adds the
  missing `128c-4s8mm6cm-15um-26um-sl`). Verify the corrected option set does not change any default or
  exported value — it is a display list only.

- **Fix `DataAcqSection` misleading debounce docs.** The handler is synchronous, not debounced. Update
  the docstring line (`DataAcqSection.jsx:17`, "Debounced save on blur" → "Saves to parent on blur") and
  the inline comment (`:53`, "save to parent with debounce" → "save to parent on blur"). Do **not**
  introduce a real debounce — synchronous blur-save is the current intended behavior; only the
  documentation is wrong.

## Deliberately not in this phase

- **The task editor modal** is built on this primitive in a later phase, not here. This phase only
  creates `Modal`/`ConfirmDialog` and migrates the two existing modals + `AlertModal`.
- **`store.js` decomposition** is a later phase. Do not touch store internals; call sites read/write
  state exactly as they do today.
- **No change to modal field sets, validation rules, save payloads, or YAML output.** This is a
  behavior-preserving refactor; the corrected device-type list is display-only and must not alter any
  persisted/exported value (golden baselines guard this).
- **`src/pages/LegacyFormView.jsx:234` `window.confirm` is left as-is.** Legacy is the frozen safety net
  (overview Non-Goals); migrating its prompts is out of scope and unnecessary, since the grep assertion
  below scopes to the new-UI surfaces only.
- **No real debounce added to `DataAcqSection`** — only the misleading docs are corrected.
- `CalendarDayCreator` already uses `role="dialog"` on its own container (`:189`); this phase does not
  reparent it into `Modal` (it is a calendar surface, not a form dialog) — only its `alert()` at `:184`
  is replaced.

## Validation slice

| Test | Asserts |
| --- | --- |
| `Modal.test.jsx` — focus trap forward | With ≥2 focusables open, Tab from the last element wraps focus to the first (`preventDefault` + focus moved). |
| `Modal.test.jsx` — focus trap backward | Shift+Tab from the first element wraps to the last. |
| `Modal.test.jsx` — ESC closes | Pressing Escape calls `onClose` once. |
| `Modal.test.jsx` — overlay click closes | Click on `.modal-overlay` calls `onClose`; click inside `.modal-content` does not. With `closeOnOverlayClick={false}`, overlay click does **not** close. |
| `Modal.test.jsx` — focus return | A button outside opens the modal; on close, focus returns to that button. |
| `Modal.test.jsx` — scroll lock | `document.body.style.overflow === 'hidden'` while open, restored to `''` on unmount. |
| `Modal.test.jsx` — ARIA | Content has `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the rendered title; `role="alertdialog"` honored when passed. |
| `CameraModal.test.jsx` (existing) | All current field/validation/save/cancel tests still pass after migration; **new:** Shift+Tab/Tab trap and focus-return now hold (regression coverage for the ported behavior). |
| `ElectrodeGroupModal.test.jsx` (existing) | All current tests still pass; **new:** focus trap AND focus return now hold (previously absent). |
| `ElectrodeGroupModal.test.jsx` — device source | The rendered `device_type` `<option>` values equal `deviceTypes()` from `valueList.js` exactly (count and membership), including `128c-4s8mm6cm-15um-26um-sl`; no hardcoded list remains. |
| `AlertModal.test.jsx` (existing) | All current tests pass after rebasing onto `Modal`; **new:** focus trap + focus return hold. |
| `ConfirmDialog.test.jsx` | Confirm button calls `onConfirm` (not `onCancel`); Cancel/ESC/overlay call `onCancel` (not `onConfirm`); `destructive` styling/`aria` applied; renders title + message. |
| `AnimalEditorStepper` delete-group test | Deleting an electrode group opens a `ConfirmDialog`; confirming removes the group; cancelling leaves it. No `window.confirm` invoked. |
| `BehavioralEventsSection` delete test | Deleting an event opens a `ConfirmDialog`; confirm removes via `onFieldUpdate`; cancel is a no-op. |
| `no-native-dialogs.test.js` (grep-style) | Source scan asserts **zero** `alert(` / `window.confirm(` / `window.alert(` occurrences under `src/pages/**` and `src/components/CalendarDayCreator/**`, excluding `src/pages/LegacyFormView.jsx`. Reads files and matches the call tokens; fails listing any offending `file:line`. |
| `golden-yaml.baseline.test.js` (existing) | All 4 fixtures remain **byte-identical** — the device-type list correction and feedback changes alter no exported value. |

Mark none as slow; all are fast jsdom/unit tests under Vitest. Use `vi.fn()` for callbacks and Testing
Library `userEvent` for Tab/Shift+Tab/ESC interactions (matches existing modal tests).

## Fixtures

None beyond existing component-test setups. The new tests use inline render helpers and `vi.fn()`
callbacks, mirroring `CameraModal.test.jsx` / `ElectrodeGroupModal.test.jsx` / `AlertModal.test.jsx`.
The grep-style test reads source files directly from disk (no fixture). Golden fixtures are the existing
four in `src/__tests__/fixtures/golden/` — unchanged.

## Review

Follow the full gate in [review-protocol.md](review-protocol.md). Phase-specific:

- **Self-verify (§1):** run this phase's Validation slice + `npx vitest run` (no regressions; baseline 2747/1 skipped) + `npx vitest run baselines` (byte-identical). Emphasis: no field/validation/payload changes — the shared `Modal` is a behavior-preserving extraction.
- **Playwright UI (§2):** open the Camera + ElectrodeGroup modals → Tab/Shift-Tab stays trapped → ESC closes → focus returns to the opener; trigger a destructive action → `ConfirmDialog` appears (no native `confirm`); confirm no `alert()` popups anywhere in scope. 0 console errors.
- **Reviewers:** `pr-review-toolkit:code-reviewer` (always), plus `type-design-analyzer` (the shared `Modal` API), `ux-reviewer`, and a WCAG 2.1 AA a11y check.
- **Checklist (§6):** every task implemented; "Deliberately not in this phase" honored; tests non-trivial (real Tab/Shift+Tab/ESC/overlay events and confirm/cancel branches, not configured-mock echoes); no plan/phase/milestone strings in code/test/component/CSS-class names or docstrings; old code flagged for removal is removed (bespoke ESC/scroll/trap/overlay effects deleted from CameraModal/ElectrodeGroupModal/AlertModal once `Modal` owns them); user-facing docs updated.
