import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Breadcrumb from './Breadcrumb';
import ReadOnlyField from './ReadOnlyField';
import KeywordsEditor from './KeywordsEditor';
import DayTechnicalSection from './DayTechnicalSection';
import { validateField } from './validation';

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
 * @returns {JSX.Element}
 */
export default function OverviewStep({ animal, day, mergedDay, onFieldUpdate, onSubjectUpdate }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [validatingField, setValidatingField] = useState(null);
  const [showInherited, setShowInherited] = useState(false);

  // Validate field on blur
  const handleBlur = useCallback(async (fieldPath, value) => {
    setValidatingField(fieldPath);

    // 1. Update store (auto-save)
    onFieldUpdate(fieldPath, value);

    // 2. Validate field
    try {
      const { valid, errors } = await validateField(mergedDay, fieldPath);

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
            <label htmlFor="experiment-description">
              Experiment Description (Optional)
            </label>
            <textarea
              id="experiment-description"
              name="session.experiment_description"
              data-field-path="experiment_description"
              rows="3"
              defaultValue={day.session.experiment_description}
              onBlur={(e) => handleBlur('session.experiment_description', e.target.value)}
              placeholder="Override animal's default experiment description if needed"
            />
            <span className="field-help-text">
              Leave blank to use animal's default: "{animal.experiment_description || 'None set'}"
            </span>
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
          View inherited metadata from animal
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
                Inherited from Animal — edits below update the animal for every day.
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
                    onBlur={(e) =>
                      onSubjectUpdate('weight', e.target.value === '' ? undefined : Number(e.target.value))
                    }
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="subject-species">Species</label>
                  <input
                    id="subject-species"
                    type="text"
                    data-field-path="subject.species"
                    key={`species-${animal.subject.species || ''}`}
                    defaultValue={animal.subject.species || ''}
                    onBlur={(e) => onSubjectUpdate('species', e.target.value.trim())}
                  />
                  <span className="field-help-text">
                    Latin binomial (e.g. Rattus norvegicus) or an NCBI Taxonomy URI — DANDI rejects free text.
                  </span>
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
};

OverviewStep.defaultProps = {
  onSubjectUpdate: () => {},
};
