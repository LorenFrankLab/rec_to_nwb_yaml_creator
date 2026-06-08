/**
 * Tests for AnimalProfileDialog — the animal-wide subject-facts editor, relocated from an always-
 * visible collapsible in the AnimalView header band into a dialog opened from the header ⋮
 * ("Edit profile…"). It owns the CONSTANT subject facts (species, sex, DOB, genotype, description;
 * `subject_id` read-only) that merge into every day's export, so it names its blast radius and
 * confirms before an animal-wide write. The form behaviour is preserved verbatim from the old
 * AnimalProfileSection; only the host (collapsible → on-demand dialog) changed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalProfileDialog from '../AnimalProfileDialog';

const animal = {
  id: 'remy',
  subject: {
    subject_id: 'remy',
    species: 'Rattus norvegicus',
    sex: 'M',
    date_of_birth: '2023-01-15T00:00:00.000Z',
    genotype: 'Wild-type',
    description: 'Long Evans',
  },
};

let user;
let onSave;
let onClose;
beforeEach(() => {
  user = userEvent.setup();
  onSave = vi.fn();
  onClose = vi.fn();
});

/**
 * Render the dialog open with default props.
 * @param {object} [overrides] - Prop overrides.
 * @returns {object} render result
 */
function renderOpen(overrides = {}) {
  return render(
    <AnimalProfileDialog isOpen animal={animal} dayCount={3} onSave={onSave} onClose={onClose} {...overrides} />
  );
}

describe('AnimalProfileDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <AnimalProfileDialog isOpen={false} animal={animal} dayCount={3} onSave={onSave} onClose={onClose} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('exposes subject_id as a read-only identity (recreate to change), not an input', () => {
    renderOpen();
    expect(screen.queryByLabelText(/^subject id$/i)).not.toBeInTheDocument();
    expect(screen.getByText('remy')).toBeInTheDocument();
  });

  it('shows species guidance (Latin binomial / NCBI URI) and DOB ISO expectation at the edit point', () => {
    renderOpen();
    expect(screen.getByText(/Latin binomial.*NCBI Taxonomy/is)).toBeInTheDocument();
    expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
    expect(screen.getByText(/ISO-8601 datetime/i)).toBeInTheDocument();
  });

  it('names the blast radius (this animal + all N recording days) before any save', () => {
    renderOpen();
    expect(screen.getByText(/all 3 recording days/i)).toBeInTheDocument();
    expect(screen.getByText(/already exported/i)).toBeInTheDocument();
  });

  it('blocks save and shows an error when species is not a binomial / URI', async () => {
    renderOpen({ dayCount: 2 });
    const species = screen.getByLabelText(/Species/i);
    await user.clear(species);
    await user.type(species, 'Rat');
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Latin binomial|NCBI/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('confirms the blast radius (names N days) before committing, then saves only the changed field', async () => {
    renderOpen({ dayCount: 4 });
    const genotype = screen.getByLabelText(/Genotype/i);
    await user.clear(genotype);
    await user.type(genotype, 'Thy1-ChR2');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    // A confirmation (the "Update profile" affordance) appears and has NOT yet saved.
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /update profile/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /update profile/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ genotype: 'Thy1-ChR2' });
  });

  it('converts an edited date of birth to ISO-8601 on save', async () => {
    renderOpen({ dayCount: 1 });
    const dob = screen.getByLabelText(/Date of Birth/i);
    await user.clear(dob);
    await user.type(dob, '2022-12-25');
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0].date_of_birth).toMatch(/^2022-12-25T/);
  });

  it('caps the date-of-birth picker at today (no future birth dates)', () => {
    renderOpen();
    const today = new Date().toISOString().split('T')[0];
    expect(screen.getByLabelText(/Date of Birth/i)).toHaveAttribute('max', today);
  });

  it('disables save when nothing has changed (no accidental animal-wide write)', () => {
    renderOpen();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('uses singular "1 recording day" copy when the animal has one day', () => {
    renderOpen({ dayCount: 1 });
    expect(screen.getByText(/all 1 recording day\b/i)).toBeInTheDocument();
  });
});
