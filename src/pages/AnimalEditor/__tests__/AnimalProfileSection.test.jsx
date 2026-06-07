/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnimalProfileSection from '../AnimalProfileSection';

/**
 * Phase 8.7 Task 2b: the Animal Profile section is the discoverable owner for the constant
 * animal/subject facts (species, sex, DOB, genotype, description). subject_id is the read-only
 * identity. Editing here is animal-wide, so a save must NAME the blast radius (this animal + all
 * N recording days, including already-exported) BEFORE committing. Species must be a Latin
 * binomial / NCBI URI (the only DANDI gate); DOB carries the ISO-8601 expectation at the edit
 * point. Weight is intentionally NOT here — it is a per-day fact (Task 2.5).
 */
describe('AnimalProfileSection', () => {
  let user;
  let onSave;

  const animal = {
    id: 'remy',
    subject: {
      subject_id: 'remy',
      species: 'Rattus norvegicus',
      sex: 'M',
      date_of_birth: '2023-01-15T00:00:00.000Z',
      genotype: 'Wild-type',
      description: 'Long Evans rat',
    },
  };

  beforeEach(() => {
    user = userEvent.setup();
    onSave = vi.fn();
  });

  /** Expand the collapsible section so the fields are in the DOM. */
  async function expand() {
    const toggle = screen.getByRole('button', { name: /animal profile/i });
    if (toggle.getAttribute('aria-expanded') !== 'true') await user.click(toggle);
  }

  it('exposes subject_id as a read-only identity (recreate to change), not an input', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={3} onSave={onSave} />);
    await expand();
    // The id is shown but not editable.
    expect(screen.queryByLabelText(/^Subject ID/i)).not.toBeInTheDocument();
    expect(screen.getByText('remy')).toBeInTheDocument();
  });

  it('shows species guidance (Latin binomial / NCBI URI) and DOB ISO expectation at the edit point', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={3} onSave={onSave} />);
    await expand();
    // The species hint carries the only-gate guidance at the edit point.
    expect(screen.getByText(/Latin binomial.*NCBI Taxonomy/is)).toBeInTheDocument();
    // DOB field is present with the ISO-8601 expectation noted (HTML5 date input → ISO on save).
    expect(screen.getByLabelText(/Date of Birth/i)).toBeInTheDocument();
    expect(screen.getByText(/ISO-8601 datetime/i)).toBeInTheDocument();
  });

  it('names the blast radius (this animal + all N recording days) before any save', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={3} onSave={onSave} />);
    await expand();
    // A persistent notice names the reach at the edit point.
    expect(screen.getByText(/all 3 recording days/i)).toBeInTheDocument();
    expect(screen.getByText(/already exported/i)).toBeInTheDocument();
  });

  it('blocks save and shows an error when species is not a binomial / URI', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={2} onSave={onSave} />);
    await expand();
    const species = screen.getByLabelText(/Species/i);
    await user.clear(species);
    await user.type(species, 'Rat');
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(/Latin binomial|NCBI/i);
  });

  it('confirms the blast radius (names N days) before committing a valid change', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={4} onSave={onSave} />);
    await expand();
    const genotype = screen.getByLabelText(/Genotype/i);
    await user.clear(genotype);
    await user.type(genotype, 'Thy1-ChR2');
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    // Confirmation names the blast radius and has NOT yet saved.
    expect(onSave).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveTextContent(/4 recording days/i);

    await user.click(screen.getByRole('button', { name: /update/i }));
    // Only the changed field is in the payload.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({ genotype: 'Thy1-ChR2' });
  });

  it('converts an edited date of birth to ISO-8601 on save', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={1} onSave={onSave} />);
    await expand();
    const dob = screen.getByLabelText(/Date of Birth/i);
    await user.clear(dob);
    await user.type(dob, '2022-12-25');
    await user.click(screen.getByRole('button', { name: /save profile/i }));
    await user.click(screen.getByRole('button', { name: /update/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    const payload = onSave.mock.calls[0][0];
    expect(payload.date_of_birth).toMatch(/^2022-12-25T/);
  });

  it('caps the date-of-birth picker at today (no future birth dates), matching the sibling surfaces', async () => {
    // DOB has no downstream future-date guard, so this UI cap is the only protection — it must
    // match AnimalCreationForm / OverviewStep (max = today), not allow a far-future date.
    render(<AnimalProfileSection animal={animal} dayCount={3} onSave={onSave} />);
    await expand();
    const today = new Date().toISOString().split('T')[0];
    expect(screen.getByLabelText(/Date of Birth/i)).toHaveAttribute('max', today);
  });

  it('disables save when nothing has changed (no accidental animal-wide write)', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={3} onSave={onSave} />);
    await expand();
    expect(screen.getByRole('button', { name: /save profile/i })).toBeDisabled();
  });

  it('uses singular "1 recording day" copy when the animal has one day', async () => {
    render(<AnimalProfileSection animal={animal} dayCount={1} onSave={onSave} />);
    await expand();
    expect(screen.getByText(/all 1 recording day\b/i)).toBeInTheDocument();
  });
});
