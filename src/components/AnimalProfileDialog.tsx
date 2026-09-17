import { SEX_OPTIONS, SPECIES_OPTIONS } from '../domain/subjectOptions';
import { FieldRequirements, RequiredMark } from './ui/FieldRequirements';
import { useId, useMemo, useState, useEffect } from 'react';
import { getAnimalSubject } from '../state/workspaceSelectors';
import { isValidSpecies } from '../validation/dandiSubject';
import { recordingFilenameIssue } from '../domain/recordingFilename';
import { subjectIdCollision } from '../domain/animalCreation';
import Modal from './Modal/Modal';
import { ConfirmDialog } from './Modal';
import BlastRadiusChip from './ui/BlastRadiusChip';
import './AnimalProfileDialog.css';
import Button from './ui/Button';
import { pluralize } from '../utils/pluralize';

/** The editable constant subject facts held by this dialog's form. */
interface ProfileForm {
  /** The exported subject id — the EXACT animal token used in the recording filenames. */
  subject_id: string;
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
  /** Optional repair-focus field path, e.g. `subject.species`. */
  focusPath?: string | null;
  /** The edited animal's store key (excluded from the subject-id collision check). */
  animalId?: string | null;
  /** The workspace animals map, to refuse a subject id another animal already uses. */
  animals?: Record<string, unknown>;
}

/**
 * Edit shared subject facts using the same species choices and required-field cues as creation.
 * A correction applies to all of the animal’s recordings and requires a scope confirmation.
 * Weight is measured on the recording day; it is deliberately absent from this form.
 */
export default function AnimalProfileDialog({
  isOpen,
  animal,
  dayCount,
  onSave,
  onClose,
  focusPath = null,
  animalId = null,
  animals,
}: AnimalProfileDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const subject = getAnimalSubject(animal);

  // The editable constant facts, seeded from the subject. DOB is held as the date-input value
  // (YYYY-MM-DD) and converted back to ISO-8601 on save (matching the creation/Overview flow).
  const initial = useMemo(
    () => ({
      subject_id: subject.subject_id || '',
      species: subject.species || '',
      sex: subject.sex || '',
      date_of_birth: (subject.date_of_birth || '').split('T')[0],
      genotype: subject.genotype || '',
      description: subject.description || '',
    }),
    [subject.subject_id, subject.species, subject.sex, subject.date_of_birth, subject.genotype, subject.description]
  );

  const [customSpecies, setCustomSpecies] = useState(false);
  const [form, setForm] = useState(initial);
  const [speciesError, setSpeciesError] = useState('');
  const trimmedSubjectId = form.subject_id.trim();
  const collidesWith = animals ? subjectIdCollision(trimmedSubjectId, animals, animalId ?? null) : null;
  const collidingSubjectId = collidesWith
    ? String(getAnimalSubject(animals![collidesWith]).subject_id || collidesWith)
    : null;
  const subjectIdError = trimmedSubjectId === ''
    ? 'Subject ID is required.'
    : (recordingFilenameIssue(trimmedSubjectId)?.message ??
      (collidingSubjectId
        ? `Subject ID "${trimmedSubjectId}" is already used by animal "${collidingSubjectId}" — two animals with one ID would export the same filenames and merge downstream.`
        : ''));
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Reseed the form whenever the dialog (re)opens or the subject changes (e.g. after a save commits),
  // so a prior in-progress edit never carries over into a fresh open.
  useEffect(() => {
    if (isOpen) {
      setForm(initial);
      setCustomSpecies(false);
      setSpeciesError('');
      setConfirmOpen(false);
    }
  }, [isOpen, initial]);

  useEffect(() => {
    if (!isOpen || !focusPath) return undefined;
    const raf = requestAnimationFrame(() => {
      const target = document.querySelector<HTMLElement>(`[data-field-path="${focusPath}"]`);
      target?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [isOpen, focusPath]);

  const setField = (field: keyof ProfileForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Only the changed fields are saved (the store merges subject by key), with DOB re-encoded. A
  // CLEARED date of birth is saved as an explicit `undefined`, which the store reads as "remove this
  // fact" (workspaceTransitions.mergeSubject) — never as `''`. An empty string would be a
  // present-but-malformed date: it keeps the animal's day exports blocked on the ISO-format message
  // ("Date of birth needs to comply with ISO 8601 format") instead of the missing-DOB message that
  // points the scientist back at this dialog, and it breaks the never-an-empty-string invariant on
  // `SubjectMetadata.date_of_birth`.
  const changedFields = useMemo(() => {
    const out: Partial<ProfileForm> = {};
    if (form.subject_id.trim() !== initial.subject_id) out.subject_id = form.subject_id.trim();
    if (form.species.trim() !== (initial.species || '').trim()) out.species = form.species.trim();
    if (form.sex !== initial.sex) out.sex = form.sex;
    if (form.date_of_birth !== initial.date_of_birth) {
      out.date_of_birth = form.date_of_birth ? new Date(form.date_of_birth).toISOString() : undefined;
    }
    if (form.genotype !== initial.genotype) out.genotype = form.genotype;
    if (form.description !== initial.description) out.description = form.description;
    return out;
  }, [form, initial]);

  const isDirty = Object.keys(changedFields).length > 0;

  const dayCountText = `${dayCount} ${pluralize(dayCount, 'recording day')}`;
  const blastRadius = `this animal and all ${dayCountText}, including any already exported`;

  const handleSaveClick = () => {
    // The exported subject id must be spellable in a recording filename (the converter matches it
    // to the `.rec` files exactly).
    if (subjectIdError) return;
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
        footer={
          <div className="form-actions">
            <Button variant="neutral" onClick={onClose}>
              Cancel
            </Button>
            <Button disabled={!isDirty || !!subjectIdError} onClick={handleSaveClick}>
              Save profile changes
            </Button>
          </div>
        }
      >
        <p className="animal-profile-blast-radius" role="note">
          <BlastRadiusChip dayCount={dayCount} />
          Shared subject facts. Editing them updates {blastRadius}. Nothing here belongs to a single
          recording day.
        </p>

        <FieldRequirements when="export" />
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="profile-subject-id">Subject ID <RequiredMark /></label>
            <input
              id="profile-subject-id"
              aria-required="true"
              type="text"
              data-field-path="subject.subject_id"
              value={form.subject_id}
              aria-invalid={!!subjectIdError}
              aria-describedby={subjectIdError ? 'profile-subject-id-error' : 'profile-subject-id-hint'}
              onChange={(e) => setField('subject_id', e.target.value)}
            />
            <span id="profile-subject-id-hint" className="field-help-text">
              Match the exact animal spelling and capitalization in your recording filenames. Letters, digits and hyphens only.
            </span>
            {subjectIdError && (
              <span id="profile-subject-id-error" className="validation-error" role="alert">
                {subjectIdError}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="profile-species">Species <RequiredMark /></label>
            <select id="profile-species" aria-required="true" data-field-path="subject.species"
              value={!customSpecies && SPECIES_OPTIONS.some((choice) => choice.value === form.species) ? form.species : 'other'}
              onChange={(event) => {
                setCustomSpecies(event.target.value === 'other');
                setField('species', event.target.value === 'other' ? '' : event.target.value);
                setSpeciesError('');
              }}>
              {SPECIES_OPTIONS.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
            </select>
            {(customSpecies || !SPECIES_OPTIONS.some((choice) => choice.value === form.species)) && <>
              <label htmlFor="profile-species-custom">Scientific name or taxonomy URI <RequiredMark /></label>
              <input id="profile-species-custom" type="text" value={form.species} aria-required="true"
                aria-invalid={!!speciesError} aria-describedby={speciesError ? 'profile-species-error' : undefined}
                onChange={(event) => setField('species', event.target.value)}
                onBlur={() => setSpeciesError(form.species.trim() && !isValidSpecies(form.species.trim()) ? 'Use a scientific name, such as Rattus norvegicus, or an NCBI Taxonomy URI.' : '')} />
            </>}
            {speciesError && (
              <span id="profile-species-error" className="validation-error" role="alert">
                {speciesError}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="profile-sex">Sex <RequiredMark /></label>
            <select
              id="profile-sex"
              aria-required="true"
              data-field-path="subject.sex"
              value={form.sex}
              onChange={(e) => setField('sex', e.target.value)}
            >
              <option value="">Unspecified</option>
              {SEX_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="profile-dob">Date of Birth <RequiredMark /></label>
            <input
              id="profile-dob"
              aria-required="true"
              type="date"
              data-field-path="subject.date_of_birth"
              value={form.date_of_birth}
              // A birth date can't be in the future — cap at today, matching the creation form and
              // the Day Overview DOB field (DOB has no downstream future-date guard).
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setField('date_of_birth', e.target.value)}
            />
            <span className="field-help-text">
              Required before export. You can leave it blank while completing a draft.
            </span>
          </div>

          <div className="form-field">
            <label htmlFor="profile-genotype">Genotype <RequiredMark /></label>
            <input
              id="profile-genotype"
              aria-required="true"
              type="text"
              data-field-path="subject.genotype"
              value={form.genotype}
              onChange={(e) => setField('genotype', e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor="profile-description">Description (optional)</label>
            <input
              id="profile-description"
              type="text"
              data-field-path="subject.description"
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
            />
          </div>
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
