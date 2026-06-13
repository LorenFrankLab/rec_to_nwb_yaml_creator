import { useId, useMemo, useState, useEffect } from 'react';
import { getAnimalSubject } from '../state/workspaceSelectors';
import { isValidSpecies } from '../validation/dandiSubject';
import Modal from './Modal/Modal';
import { ConfirmDialog } from './Modal';
import './AnimalProfileDialog.css';

/** The editable constant subject facts held by this dialog's form. */
interface ProfileForm {
  species: string;
  sex: string;
  date_of_birth: string;
  genotype: string;
  description: string;
}

interface AnimalProfileDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** The animal record (`subject`). */
  animal?: unknown;
  /** Number of recording days owned by this animal (blast radius). */
  dayCount: number;
  /** Called with the changed subject fields only (a partial `{ field: value }`). */
  onSave: (changedFields: Partial<ProfileForm>) => void;
  /** Called for ESC / overlay / Cancel. */
  onClose: () => void;
}

/**
 * AnimalProfileDialog — the animal-wide subject-facts editor, opened from the AnimalView header ⋮
 * ("Edit profile…").
 *
 * It owns the CONSTANT subject facts (species, sex, date of birth, genotype, description).
 * `subject_id` is the read-only identity (recreate the animal to change it). Weight is intentionally
 * absent — it is a per-day recording fact, not a constant animal fact. Editing here is animal-wide
 * (`animal.subject.*` merges into every day at export), so it NAMES the blast radius — this animal +
 * all N recording days, including already-exported ones — both as a persistent note AND in a confirm
 * before the change commits. Species carries the DANDI Latin-binomial / NCBI guidance (the app's
 * `invalid_species` rule is the only gate); DOB carries the ISO-8601 expectation.
 *
 * Relocated from the always-visible collapsible AnimalProfileSection (which cluttered the header band
 * on every tab) into this on-demand dialog; the form behaviour is preserved.
 *
 */
export default function AnimalProfileDialog({
  isOpen,
  animal,
  dayCount,
  onSave,
  onClose,
}: AnimalProfileDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
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

  const [form, setForm] = useState(initial);
  const [speciesError, setSpeciesError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reseed the form whenever the dialog (re)opens or the subject changes (e.g. after a save commits),
  // so a prior in-progress edit never carries over into a fresh open.
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setSpeciesError('');
      setConfirmOpen(false);
    }
  }, [isOpen, initial]);

  const setField = (field: keyof ProfileForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Only the changed fields are saved (the store shallow-merges subject), with DOB re-encoded.
  const changedFields = useMemo(() => {
    const out: Partial<ProfileForm> = {};
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
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Edit animal profile"
        titleId={titleId}
        className="animal-profile-dialog"
      >
        <p className="animal-profile-blast-radius" role="note">
          Shared subject facts. Editing them updates {blastRadius}. Nothing here belongs to a single
          recording day.
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
              Scientific name — a Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy URI.
              Free text like &quot;Rat&quot; is rejected by NWB/DANDI archives.
            </span>
            {speciesError && (
              <span id="profile-species-error" className="validation-error" role="alert">
                {speciesError}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="profile-sex">Sex</label>
            <select id="profile-sex" value={form.sex} onChange={(e) => setField('sex', e.target.value)}>
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
              // A birth date can't be in the future — cap at today, matching the creation form and
              // the Day Overview DOB field (DOB has no downstream future-date guard).
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

        <div className="form-actions">
          <button type="button" className="btn-cancel" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="button-primary" disabled={!isDirty} onClick={handleSaveClick}>
            Save profile changes
          </button>
        </div>
      </Modal>

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
    </>
  );
}

