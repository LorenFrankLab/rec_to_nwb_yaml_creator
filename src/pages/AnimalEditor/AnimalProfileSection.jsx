import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { getAnimalSubject } from '../../state/workspaceSelectors';
import { isValidSpecies } from '../../validation/dandiSubject';
import { ConfirmDialog } from '../../components/Modal';
import './AnimalProfileSection.scss';

/**
 * AnimalProfileSection — Phase 8.7 Task 2b.
 *
 * The discoverable owner for the animal's CONSTANT subject facts (species, sex, date of birth,
 * genotype, description). `subject_id` is the read-only identity (recreate the animal to change
 * it). Weight is intentionally absent — it is a per-day recording fact (Task 2.5), not a constant
 * animal fact.
 *
 * Editing here is animal-wide (`animal.subject.*` is merged into every day at export), so this
 * follows the headline promise: it NAMES the blast radius — this animal + all N recording days,
 * including already-exported ones — both as a persistent notice at the edit point AND in a
 * confirmation before the change is committed. Species carries the DANDI Latin-binomial / NCBI
 * URI guidance (the app's `invalid_species` rule is the only gate); DOB carries the ISO-8601
 * expectation. Home remains the creation surface and the Day Overview keeps inline repair, but
 * this section means the Day Overview is no longer the only discoverable correction path.
 *
 * @param {object} props
 * @param {object} props.animal - The animal record (`subject`).
 * @param {number} props.dayCount - Number of recording days owned by this animal (blast radius).
 * @param {Function} props.onSave - Called with the changed subject fields only (a partial
 *   `{ field: value }`); the parent shallow-merges via `updateAnimal(id, { subject })`.
 * @returns {JSX.Element}
 */
export default function AnimalProfileSection({ animal, dayCount, onSave }) {
  const subject = getAnimalSubject(animal);

  // The editable constant facts, seeded from the subject. DOB is held as the date-input value
  // (YYYY-MM-DD) and converted back to ISO-8601 on save (matching the creation/Overview flow).
  const initial = useMemo(
    () => ({
      species: subject.species || '',
      sex: subject.sex || '',
      date_of_birth: (subject.date_of_birth || '').split('T')[0],
      genotype: subject.genotype || '',
      description: subject.description || '',
    }),
    [subject.species, subject.sex, subject.date_of_birth, subject.genotype, subject.description]
  );

  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState(initial);
  const [speciesError, setSpeciesError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Resync when the subject changes externally (e.g. after this section's own save commits).
  useEffect(() => {
    setForm(initial);
    setSpeciesError('');
  }, [initial]);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  // Only the changed fields are saved (the store shallow-merges subject), with DOB re-encoded.
  const changedFields = useMemo(() => {
    const out = {};
    if (form.species.trim() !== (initial.species || '').trim()) out.species = form.species.trim();
    if (form.sex !== initial.sex) out.sex = form.sex;
    if (form.date_of_birth !== initial.date_of_birth) {
      out.date_of_birth = form.date_of_birth ? new Date(form.date_of_birth).toISOString() : '';
    }
    if (form.genotype !== initial.genotype) out.genotype = form.genotype;
    if (form.description !== initial.description) out.description = form.description;
    return out;
  }, [form, initial]);

  const isDirty = Object.keys(changedFields).length > 0;

  const dayCountText = `${dayCount} recording day${dayCount === 1 ? '' : 's'}`;
  const blastRadius = `this animal and all ${dayCountText}, including any already exported`;

  const handleSaveClick = () => {
    // Species is the only DANDI gate — block a non-binomial/URI value before the animal-wide write.
    const species = form.species.trim();
    if (species !== '' && !isValidSpecies(species)) {
      setSpeciesError('Use a Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy URI.');
      return;
    }
    if (!isDirty) return;
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    setConfirmOpen(false);
    onSave(changedFields);
  };

  return (
    <section className="animal-profile-section" aria-label="Animal Profile">
      <button
        type="button"
        className="animal-profile-toggle"
        aria-expanded={expanded}
        aria-controls="animal-profile-content"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="toggle-icon" aria-hidden="true">{expanded ? '▼' : '▶'}</span>
        Animal Profile
        <span className="animal-profile-summary">
          {subject.species || 'species not set'}
          {subject.sex ? ` · ${subject.sex}` : ''}
        </span>
      </button>

      {expanded && (
        <div id="animal-profile-content" className="animal-profile-content">
          <p className="animal-profile-blast-radius" role="note">
            Shared subject facts. Editing them updates {blastRadius}. Nothing here belongs to a
            single recording day.
          </p>

          <div className="form-grid">
            <div className="form-field">
              <span className="field-label">Subject ID</span>
              <span className="readonly-value">{subject.subject_id || '—'}</span>
              <span className="field-help-text">
                Identity — set at animal creation. Recreate the animal to change it.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="profile-species">Species</label>
              <input
                id="profile-species"
                type="text"
                value={form.species}
                aria-invalid={!!speciesError}
                aria-describedby={speciesError ? 'profile-species-error' : 'profile-species-hint'}
                onChange={(e) => {
                  setField('species', e.target.value);
                  if (speciesError) setSpeciesError('');
                }}
                onBlur={(e) => {
                  const value = e.target.value.trim();
                  setSpeciesError(
                    value !== '' && !isValidSpecies(value)
                      ? 'Use a Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy URI.'
                      : ''
                  );
                }}
              />
              <span id="profile-species-hint" className="field-help-text">
                Scientific name — a Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy
                URI. Free text like &quot;Rat&quot; is rejected by NWB/DANDI archives.
              </span>
              {speciesError && (
                <span id="profile-species-error" className="validation-error" role="alert">
                  {speciesError}
                </span>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="profile-sex">Sex</label>
              <select
                id="profile-sex"
                value={form.sex}
                onChange={(e) => setField('sex', e.target.value)}
              >
                <option value="">Unspecified</option>
                <option value="M">Male (M)</option>
                <option value="F">Female (F)</option>
                <option value="U">Unknown (U)</option>
              </select>
            </div>

            <div className="form-field">
              <label htmlFor="profile-dob">Date of Birth</label>
              <input
                id="profile-dob"
                type="date"
                value={form.date_of_birth}
                // A birth date can't be in the future — cap at today, matching the creation form
                // (AnimalCreationForm) and the Day Overview DOB field. (DOB has no downstream
                // future-date guard, so this UI cap is the only protection.)
                max={new Date().toISOString().split('T')[0]}
                onChange={(e) => setField('date_of_birth', e.target.value)}
              />
              <span className="field-help-text">
                Stored as an ISO-8601 datetime (e.g. 2023-01-15T00:00:00) for NWB.
              </span>
            </div>

            <div className="form-field">
              <label htmlFor="profile-genotype">Genotype</label>
              <input
                id="profile-genotype"
                type="text"
                value={form.genotype}
                onChange={(e) => setField('genotype', e.target.value)}
              />
            </div>

            <div className="form-field">
              <label htmlFor="profile-description">Description</label>
              <input
                id="profile-description"
                type="text"
                value={form.description}
                onChange={(e) => setField('description', e.target.value)}
              />
            </div>
          </div>

          <div className="animal-profile-actions">
            <button
              type="button"
              className="button-primary"
              disabled={!isDirty}
              onClick={handleSaveClick}
            >
              Save profile changes
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Update animal profile?"
        message={
          `This updates ${blastRadius}. These subject facts are the same for the animal's whole ` +
          `life, so the correction applies to every recording day. Continue?`
        }
        confirmLabel="Update profile"
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}

AnimalProfileSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string,
    subject: PropTypes.object,
  }).isRequired,
  dayCount: PropTypes.number.isRequired,
  onSave: PropTypes.func.isRequired,
};
