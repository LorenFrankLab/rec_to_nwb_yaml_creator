/**
 * Tests for AnimalDeleteDialog — the type-to-confirm animal-delete dialog (Phase 4, Task 4.1a).
 *
 * Deleting an animal is the app's only irreversible, whole-animal-wiping action (its shared setup
 * AND all its recording days at once), so the confirm gates the Delete button behind typing the
 * animal's id exactly — and states the cascade (deletable days + preserved wrong-owner / surviving
 * recovered records + the downloaded-artifacts caveat). Shared by the picker ⋮ and the header ⋮.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalDeleteDialog from '../AnimalDeleteDialog';

const animal = { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-2023-06-22', 'remy-2023-06-23'] };
const days = {
  'remy-2023-06-22': { id: 'remy-2023-06-22', animalId: 'remy', date: '2023-06-22', state: { exported: true } },
  'remy-2023-06-23': { id: 'remy-2023-06-23', animalId: 'remy', date: '2023-06-23', state: { draft: true } },
};

/**
 * Render the dialog open with default props.
 * @param {object} [overrides] - Prop overrides.
 * @returns {{ onConfirm: Function, onCancel: Function, user: object }}
 */
function renderDialog(overrides = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(
    <AnimalDeleteDialog isOpen animalId="remy" animal={animal} days={days} onConfirm={onConfirm} onCancel={onCancel} {...overrides} />
  );
  return { onConfirm, onCancel, user };
}

describe('AnimalDeleteDialog', () => {
  it('states the cascade: the animal + its deletable day count + the downloaded-artifacts caveat', () => {
    renderDialog();
    const dialog = screen.getByRole('alertdialog', { name: /delete animal/i });
    expect(within(dialog).getByText(/2 recording days/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/does not delete any YAML you already downloaded/i)).toBeInTheDocument();
  });

  it('disables Delete until the typed name matches the animal id exactly', async () => {
    const { onConfirm, user } = renderDialog();
    const confirm = screen.getByRole('button', { name: /^delete animal$/i });
    expect(confirm).toBeDisabled();

    const field = screen.getByRole('textbox', { name: /type .* to confirm/i });
    await user.type(field, 'rem'); // partial
    expect(confirm).toBeDisabled();
    await user.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(field, 'y'); // now "remy"
    expect(confirm).toBeEnabled();
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('matches the id trimmed (leading/trailing whitespace ignored)', async () => {
    const { user } = renderDialog();
    const field = screen.getByRole('textbox', { name: /type .* to confirm/i });
    await user.type(field, '  remy  ');
    expect(screen.getByRole('button', { name: /^delete animal$/i })).toBeEnabled();
  });

  it('cancel aborts without confirming', async () => {
    const { onConfirm, onCancel, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders nothing when closed', () => {
    const { container } = render(
      <AnimalDeleteDialog isOpen={false} animalId="remy" animal={animal} days={days} onConfirm={() => {}} onCancel={() => {}} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
