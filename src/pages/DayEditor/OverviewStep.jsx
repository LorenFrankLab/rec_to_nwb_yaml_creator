import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import Breadcrumb from './Breadcrumb';
import ReadOnlyField from './ReadOnlyField';
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
 * @returns {JSX.Element}
 */
export default function OverviewStep({ animal, day, mergedDay, onFieldUpdate }) {
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

  // Format date for display
  const formattedDate = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Breadcrumb items
  const breadcrumbItems = [
    { label: 'Home', href: '#/' },
    { label: `Animal: ${animal.id}`, href: `#/animal/${animal.id}` },
    { label: `Day: ${day.date}` },
  ];

  return (
    <div className="overview-step">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      {/* Context Header */}
      <header className="day-context-header">
        <h1 className="day-title">
          <span className="animal-id">{animal.id}</span>
          <span className="date-separator">•</span>
          <span className="day-date">{formattedDate}</span>
        </h1>
      </header>

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
          <div className="form-field">
            <label htmlFor="session-id" className="required">
              Session ID
            </label>
            <input
              id="session-id"
              type="text"
              name="session.session_id"
              defaultValue={day.session.session_id}
              onBlur={(e) => handleBlur('session.session_id', e.target.value)}
              className={fieldErrors['session.session_id'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.session_id']}
              aria-describedby={
                fieldErrors['session.session_id'] ? 'session-id-error' : 'session-id-hint'
              }
              required
            />
            <span id="session-id-hint" className="validation-hint">
              Format: {animal.id}_YYYYMMDD (e.g., {animal.id}_20230622)
            </span>
            {validatingField === 'session.session_id' && (
              <span className="validation-loading" role="status" aria-live="polite">
                <span className="spinner" aria-hidden="true">⟳</span>
                Validating...
              </span>
            )}
            {fieldErrors['session.session_id'] && (
              <span id="session-id-error" className="validation-error" role="alert">
                {fieldErrors['session.session_id'].message}
              </span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="session-description" className="required">
              Session Description
            </label>
            <textarea
              id="session-description"
              name="session.session_description"
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
              rows="3"
              defaultValue={day.session.experiment_description}
              onBlur={(e) => handleBlur('session.experiment_description', e.target.value)}
              placeholder="Override animal's default experiment description if needed"
            />
            <span className="field-help-text">
              Leave blank to use animal's default: "{animal.experiment_description || 'None set'}"
            </span>
          </div>
        </div>
      </section>

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
            {/* Subject Information */}
            <div className="inherited-section">
              <h3>Subject Information</h3>
              <div className="inherited-notice">
                Inherited from Animal
                <a href={`#/animal/${animal.id}`}>Edit Animal</a>
              </div>

              <div className="form-grid">
                <ReadOnlyField
                  label="Subject ID"
                  value={animal.subject.subject_id}
                />
                <ReadOnlyField
                  label="Species"
                  value={animal.subject.species}
                />
                <ReadOnlyField
                  label="Sex"
                  value={animal.subject.sex}
                />
                <ReadOnlyField
                  label="Genotype"
                  value={animal.subject.genotype}
                />
                <ReadOnlyField
                  label="Date of Birth"
                  value={animal.subject.date_of_birth}
                />
              </div>
            </div>

            {/* Experimenters */}
            <div className="inherited-section">
              <h3>Experimenters</h3>
              <div className="inherited-notice">
                Inherited from Animal
                <a href={`#/animal/${animal.id}`}>Edit Animal</a>
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
    session: PropTypes.shape({
      session_id: PropTypes.string,
      session_description: PropTypes.string,
      experiment_description: PropTypes.string,
    }).isRequired,
  }).isRequired,
  mergedDay: PropTypes.object.isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
