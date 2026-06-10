/**
 * Pins the section-nav unsaved-edit discard guard (charter decision 2).
 *
 * WHY A PURE-DECISION TEST (and not a full browser-path render): the guard's live path is currently
 * UNREACHABLE in the shipped UI. Every setup editor that reports `pendingEdits`
 * (ElectrodeGroupsContainer, ChannelMapsContainer via ChannelMapEditor, CamerasContainer) is a
 * focus-trapping shared `Modal` whose overlay intercepts the section-nav click BEFORE
 * `handleNavClick` runs — so a jsdom render can never get `pendingEdits === true` AND a clickable
 * nav link at the same time. The guard is correct, intentional safety code kept for a FUTURE inline
 * (non-modal) setup editor. To pin it honestly we test the extracted pure decision
 * `shouldInterceptNavDiscard` (which `handleNavClick` delegates to) directly, plus the
 * Keep-editing / Discard-changes wiring of the ConfirmDialog it drives.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../../../components/Modal';
import { shouldInterceptNavDiscard } from '../index';

/** A plain primary-button click (no modifiers). */
const PLAIN_CLICK = { button: 0 };

describe('shouldInterceptNavDiscard — the discard guard decision', () => {
  it('INTERCEPTS a plain primary click to a DIFFERENT tab while there are pending edits', () => {
    expect(
      shouldInterceptNavDiscard({
        targetKey: 'cameras',
        currentTab: 'electrode-groups',
        pendingEdits: true,
        event: PLAIN_CLICK,
      })
    ).toBe(true);
  });

  it('falls through when there are NO pending edits (normal navigation)', () => {
    expect(
      shouldInterceptNavDiscard({
        targetKey: 'cameras',
        currentTab: 'electrode-groups',
        pendingEdits: false,
        event: PLAIN_CLICK,
      })
    ).toBe(false);
  });

  it('falls through for a SAME-tab click even with pending edits (no navigation to confirm)', () => {
    expect(
      shouldInterceptNavDiscard({
        targetKey: 'electrode-groups',
        currentTab: 'electrode-groups',
        pendingEdits: true,
        event: PLAIN_CLICK,
      })
    ).toBe(false);
  });

  it('falls through for modifier / non-primary clicks (those open a SEPARATE document)', () => {
    for (const event of [
      { button: 0, metaKey: true },
      { button: 0, ctrlKey: true },
      { button: 0, shiftKey: true },
      { button: 0, altKey: true },
      { button: 1 }, // middle-click
    ]) {
      expect(
        shouldInterceptNavDiscard({
          targetKey: 'cameras',
          currentTab: 'electrode-groups',
          pendingEdits: true,
          event,
        })
      ).toBe(false);
    }
  });
});

/**
 * The dialog the guard opens once a click is intercepted. This pins the user-facing wiring:
 * "Keep editing" cancels (no navigation), "Discard changes" proceeds. We render the SAME
 * ConfirmDialog AnimalView uses with the SAME labels, since the live AnimalView path is unreachable.
 */
describe('discard-confirm dialog wiring (Keep editing cancels, Discard proceeds)', () => {
  beforeEach(() => {
    delete window.location;
    window.location = { hash: '#/animal/remy/electrode-groups' };
  });
  afterEach(() => {
    window.location = { hash: '' };
  });

  /**
   * Render the guard's dialog with onConfirm/onCancel that mimic AnimalView's handlers:
   * confirm navigates to the queued tab; cancel clears the queue without navigating.
   * @returns {{ navigated: () => string|null }}
   */
  function renderDialog() {
    let navigated = null;
    render(
      <ConfirmDialog
        isOpen
        title="Discard unsaved changes?"
        message="You have unsaved changes in this editor. Leaving this section will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={() => {
          navigated = '#/animal/remy/cameras';
          window.location.hash = navigated;
        }}
        onCancel={() => {
          navigated = null;
        }}
      />
    );
    return { navigated: () => navigated };
  }

  it('shows the "Discard unsaved changes?" dialog', () => {
    renderDialog();
    expect(screen.getByText('Discard unsaved changes?')).toBeInTheDocument();
  });

  it('"Keep editing" cancels — no navigation occurs', async () => {
    const user = userEvent.setup();
    const result = renderDialog();
    await user.click(screen.getByRole('button', { name: /keep editing/i }));
    expect(result.navigated()).toBeNull();
    expect(window.location.hash).toBe('#/animal/remy/electrode-groups');
  });

  it('"Discard changes" proceeds — navigation to the queued tab occurs', async () => {
    const user = userEvent.setup();
    const result = renderDialog();
    await user.click(screen.getByRole('button', { name: /discard changes/i }));
    expect(result.navigated()).toBe('#/animal/remy/cameras');
    expect(window.location.hash).toBe('#/animal/remy/cameras');
  });
});
