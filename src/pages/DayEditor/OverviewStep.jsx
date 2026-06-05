import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Breadcrumb from './Breadcrumb';
import ReadOnlyField from './ReadOnlyField';
import KeywordsEditor from './KeywordsEditor';
import DayTechnicalSection from './DayTechnicalSection';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import { validateField } from './validation';
import { isValidSpecies } from '../../validation/dandiSubject';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';

// The day-owned collections this step owns (raw-shape reset surface).
const OVERVIEW_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'overview');

/**
 * Overview Step - Minimalist session metadata editor
 *
 * Shows only day-specific editable fields with breadcrumb navigation.
 * Inherited animal metadata is available in a collapsible section.
 *
 * UX Philosophy:
 * - Show what matters: animal ID + date for context
 * - Edit what's unique: session-specific metadata
 * - Hide what's inherited: subject/experimenters (available if needed)
 *
 * @param {object} props
 * @param {import('@/state/workspaceTypes').Animal} props.animal - Animal record (read-only context)
 * @param {import('@/state/workspaceTypes').Day} props.day - Day record (editable)
 * @param {object} props.mergedDay - Merged animal + day for validation
 * @param {Function} props.onFieldUpdate - Callback: (fieldPath, value) => void
 * @param props.onSubjectUpdate
 * @param props.focusRequest
 * @returns {JSX.Element}
 */
export default function OverviewStep({ animal, day, mergedDay, onFieldUpdate, onSubjectUpdate, focusRequest }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [validatingField, setValidatingField] = useState(null);
  const [showInherited, setShowInherited] = useState(false);
  // Inline error for the species repair field — without it the field could silently
  // write an invalid value through to the animal, recreating the "blocked at export
  // with no place to fix" trap this repair surface exists to remove.
  const [speciesError, setSpeciesError] = useState('');

  // A repair action for a subject field (e.g. subject.date_of_birth) routes here, but
  // those controls live inside the collapsed "inherited metadata" section. Expand the
  // section when a subject field is the focus target, **during render** (the
  // adjust-state-from-props pattern) rather than in a passive effect — so the control
  // is present in the same commit the parent stepper searches for the focus anchor.
  // A passive effect would expand a tick later and the stepper could search first,
  // miss the anchor, and fall back to the step with no retry.
  const focusFieldPath = focusRequest?.fieldPath;
  const focusToken = focusRequest?.token ?? null;
  const [seenFocusToken, setSeenFocusToken] = useState(null);
  if (focusToken !== seenFocusToken) {
    setSeenFocusToken(focusToken);
    if (typeof focusFieldPath === 'string' && focusFieldPath.startsWith('subject.')) {
      setShowInherited(true);
    }
  }

  // Validate field on blur. The session fields are stored nested under `day.session`
  // (the write path, e.g. `session.experiment_description`) but the export emits them
  // at the TOP level (e.g. `experiment_description`) — which is the path the schema
  // error carries. Validating the stale `mergedDay` at the nested write path showed no
  // error even when the field was emptied. Instead, patch the just-typed value onto a
  // clone of the merged model at its exported (top-level) path and validate there, so
  // the inline error reflects the current value.
  const handleBlur = useCallback(async (fieldPath, value) => {
    setValidatingField(fieldPath);

    // 1. Update store (auto-save)
    onFieldUpdate(fieldPath, value);

    // 2. Validate the just-edited value at its exported path
    try {
      const validatePath = fieldPath.startsWith('session.')
        ? fieldPath.slice('session.'.length)
        : fieldPath;
      const patched = structuredClone(mergedDay);
      patched[validatePath] = value;

      const { valid, errors } = await validateField(patched, validatePath);

      setFieldErrors(prev => ({
        ...prev,
        [fieldPath]: valid ? null : errors[0],
      }));
    } catch (error) {
      console.error('Validation error:', error);
      setFieldErrors(prev => ({
        ...prev,
        [fieldPath]: { message: 'Validation failed - please try again' },
      }));
    } finally {
      setValidatingField(null);
    }
  }, [mergedDay, onFieldUpdate]);

  // Count validation errors for ARIA announcement
  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '#/home' },
    { label: `Animal: ${animal.id}`, href: `#/animal/${animal.id}/editor` },
    { label: `Day: ${day.date}` },
  ];

  return (
    <div className="overview-step">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <MalformedCollectionNotice
        day={day}
        fields={OVERVIEW_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

      {/* ARIA live region for screen readers */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {errorCount > 0 && `${errorCount} validation ${errorCount === 1 ? 'error' : 'errors'}`}
      </div>

      {/* Session Metadata (Day-Specific Editable Fields) */}
      <section className="day-editor-section">
        <h2>Session Metadata</h2>

        <div className="form-grid">
          <ReadOnlyField
            label="Session ID"
            value={day.session.session_id}
            helpText={`Auto-generated from animal ID and date: ${animal.id}_${day.date.replace(/-/g, '')}`}
          />

          <div className="form-field">
            <label htmlFor="session-description" className="required">
              Session Description
            </label>
            <textarea
              id="session-description"
              name="session.session_description"
              data-field-path="session_description"
              rows="3"
              defaultValue={day.session.session_description}
              onBlur={(e) => handleBlur('session.session_description', e.target.value)}
              className={fieldErrors['session.session_description'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.session_description']}
              aria-describedby={
                fieldErrors['session.session_description'] ? 'session-description-error' : null
              }
              required
            />
            {fieldErrors['session.session_description'] && (
              <span id="session-description-error" className="validation-error" role="alert">
                {fieldErrors['session.session_description'].message}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="experiment-description" className="required">
              Experiment Description
            </label>
            <textarea
              id="experiment-description"
              name="session.experiment_description"
              data-field-path="experiment_description"
              rows="3"
              defaultValue={day.session.experiment_description || animal.experiment_description || ''}
              onBlur={(e) => handleBlur('session.experiment_description', e.target.value)}
              placeholder="e.g., Chronic tetrode recording during spatial navigation"
              className={fieldErrors['session.experiment_description'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.experiment_description']}
              required
            />
            <span className="field-help-text">
              Describes the overall experiment. Required for export and written to the NWB file.
            </span>
            {fieldErrors['session.experiment_description'] && (
              <span className="validation-error" role="alert">
                {fieldErrors['session.experiment_description'].message}
              </span>
            )}
          </div>

          <KeywordsEditor
            value={day.keywords}
            onChange={(keywords) => onFieldUpdate('keywords', keywords)}
          />
        </div>
      </section>

      {/* Per-day technical parameters (default header path + units) live on
          day.technical, where the export reads them. */}
      <DayTechnicalSection technical={day.technical} onFieldUpdate={onFieldUpdate} />

      {/* Collapsible Inherited Metadata */}
      <section className="inherited-metadata-section">
        <button
          type="button"
          className="inherited-metadata-toggle"
          onClick={() => setShowInherited(!showInherited)}
          aria-expanded={showInherited}
          aria-controls="inherited-metadata-content"
        >
          <span className="toggle-icon" aria-hidden="true">
            {showInherited ? '▼' : '▶'}
          </span>
          View / edit inherited subject metadata
          <span className="inherited-metadata-badge">Inherited</span>
        </button>

        {showInherited && (
          <div id="inherited-metadata-content" className="inherited-metadata-content">
            {/* Subject Information. Identity fields are read-only; the fields a
                recording-day scientist commonly needs to repair (date of birth,
                weight, description, species) are editable here and write through to
                the animal so existing animals can be fixed without leaving the day. */}
            <div className="inherited-section">
              <h3>Subject Information</h3>
              <div className="inherited-notice">
                Inherited from Animal — editing these fields updates the animal record
                shared by all of its recording days, including any already exported.
                <a href={`#/animal/${animal.id}/editor`}>Edit Animal</a>
              </div>

              <div className="form-grid">
                <ReadOnlyField label="Subject ID" value={animal.subject.subject_id} />
                <ReadOnlyField label="Sex" value={animal.subject.sex} />
                <ReadOnlyField label="Genotype" value={animal.subject.genotype} />

                <div className="form-field">
                  <label htmlFor="subject-date-of-birth">Date of Birth</label>
                  <input
                    id="subject-date-of-birth"
                    type="date"
                    data-field-path="subject.date_of_birth"
                    key={animal.subject.date_of_birth || ''}
                    defaultValue={(animal.subject.date_of_birth || '').split('T')[0]}
                    max={new Date().toISOString().split('T')[0]}
                    onBlur={(e) =>
                      onSubjectUpdate(
                        'date_of_birth',
                        e.target.value ? new Date(e.target.value).toISOString() : ''
                      )
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="subject-weight">Weight (grams)</label>
                  <input
                    id="subject-weight"
                    type="number"
                    min="0"
                    step="any"
                    data-field-path="subject.weight"
                    key={`weight-${animal.subject.weight ?? ''}`}
                    defaultValue={animal.subject.weight ?? ''}
                    onBlur={(e) => {
                      onSubjectUpdate('weight', e.target.value === '' ? undefined : Number(e.target.value));
                      // The export prefers a day-level weight override over the animal
                      // weight, so a stale/invalid day override (only ever set via import)
                      // would defeat this repair. Clear it so the weight just entered is
                      // the value that's exported.
                      if (day.session.weight !== undefined) {
                        onFieldUpdate('session.weight', undefined);
                      }
                    }}
                  />
                  <span className="field-help-text">Animal baseline weight, in grams.</span>
                </div>

                <div className="form-field">
                  <label htmlFor="subject-species">Species</label>
                  <input
                    id="subject-species"
                    type="text"
                    data-field-path="subject.species"
                    key={`species-${animal.subject.species || ''}`}
                    defaultValue={animal.subject.species || ''}
                    aria-invalid={!!speciesError}
                    aria-describedby={speciesError ? 'subject-species-error' : 'subject-species-hint'}
                    onBlur={(e) => {
                      const value = e.target.value.trim();
                      // Surface the format error here (the value still writes through so
                      // the export gate agrees), so the user isn't silently left invalid.
                      setSpeciesError(
                        value !== '' && !isValidSpecies(value)
                          ? 'Use a Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy URI.'
                          : ''
                      );
                      onSubjectUpdate('species', value);
                    }}
                  />
                  <span id="subject-species-hint" className="field-help-text">
                    Scientific name (e.g. Rattus norvegicus) or an NCBI Taxonomy URI. Free text
                    like &quot;Rat&quot; is rejected by NWB archives.
                  </span>
                  {speciesError && (
                    <span id="subject-species-error" className="validation-error" role="alert">
                      {speciesError}
                    </span>
                  )}
                </div>

                <div className="form-field">
                  <label htmlFor="subject-description">Description</label>
                  <input
                    id="subject-description"
                    type="text"
                    data-field-path="subject.description"
                    key={`desc-${animal.subject.description || ''}`}
                    defaultValue={animal.subject.description || ''}
                    onBlur={(e) => onSubjectUpdate('description', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Experimenters */}
            <div className="inherited-section">
              <h3>Experimenters</h3>
              <div className="inherited-notice">
                Inherited from Animal
                <a href={`#/animal/${animal.id}/editor`}>Edit Animal</a>
              </div>

              <div className="form-grid">
                <ReadOnlyField
                  label="Names"
                  value={animal.experimenters.experimenter_name.join(', ')}
                />
                <ReadOnlyField
                  label="Lab"
                  value={animal.experimenters.lab}
                />
                <ReadOnlyField
                  label="Institution"
                  value={animal.experimenters.institution}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

OverviewStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    experiment_description: PropTypes.string,
    subject: PropTypes.shape({
      subject_id: PropTypes.string.isRequired,
      species: PropTypes.string.isRequired,
      sex: PropTypes.string.isRequired,
      genotype: PropTypes.string.isRequired,
      date_of_birth: PropTypes.string.isRequired,
    }).isRequired,
    experimenters: PropTypes.shape({
      experimenter_name: PropTypes.arrayOf(PropTypes.string).isRequired,
      lab: PropTypes.string.isRequired,
      institution: PropTypes.string.isRequired,
    }).isRequired,
  }).isRequired,
  day: PropTypes.shape({
    date: PropTypes.string.isRequired,
    keywords: PropTypes.arrayOf(PropTypes.string),
    session: PropTypes.shape({
      session_id: PropTypes.string,
      session_description: PropTypes.string,
      experiment_description: PropTypes.string,
    }).isRequired,
    technical: PropTypes.shape({
      default_header_file_path: PropTypes.string,
      units: PropTypes.shape({
        analog: PropTypes.string,
        behavioral_events: PropTypes.string,
      }),
    }),
  }).isRequired,
  mergedDay: PropTypes.object.isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onSubjectUpdate: PropTypes.func,
  focusRequest: PropTypes.shape({
    fieldPath: PropTypes.string,
    token: PropTypes.number,
  }),
};

OverviewStep.defaultProps = {
  onSubjectUpdate: () => {},
  focusRequest: null,
};
