import { useState, useCallback } from 'react';
import Breadcrumb from './Breadcrumb';
import ReadOnlyField from './ReadOnlyField';
import KeywordsEditor from './KeywordsEditor';
import DayTechnicalSection from './DayTechnicalSection';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import { validateField } from './validation';
import { isValidSpecies } from '../../validation/dandiSubject';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getDaySession,
  getDayKeywords,
  getAnimalSubject,
  getAnimalExperimenters,
  getExperimenterNames,
  getAnimalDayIds,
} from '../../state/workspaceSelectors';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';

interface OverviewStepProps extends DayEditorBundle {
  /** Writes a subject field through to the animal record (e.g. `('species', value)`). */
  onSubjectUpdate?: (field: string, value: string) => void;
  /** A repair request focusing a subject field — expands the inherited section during render. */
  focusRequest?: { fieldPath?: string; token?: number } | null;
  /** Executes an issue's `repairCommand` in place (resets a malformed session record). */
  onRepair?: (issue: unknown) => void;
}

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
 */
export default function OverviewStep(props: OverviewStepProps) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). Section-specific props stay direct.
  const { animal, day, mergedDay, onFieldUpdate, animalKey = undefined } = useDayEditorContext(props);
  const { onSubjectUpdate = () => {}, focusRequest = null, onRepair } = props;
  // The store OWNER KEY (resolved by DayEditorStepper). Animal-editor links and the derived
  // session_id help text use it so a stale/missing `animal.id` record field can't misroute a
  // recovered animal's repair; falls back to `animal.id` for isolated renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;
  // Tolerate corrupt persisted state: a malformed (null/scalar) `day.session`,
  // `animal.subject`, or `animal.experimenters` must not crash the editor on a raw
  // dereference. Read through the canonical shape-safe selectors (the single place these
  // guards live), so a corrupt record renders blank fields the user can fix, never a
  // blank/crashed step.
  const session = getDaySession(day);
  const subject = getAnimalSubject(animal);
  // Phase 8.7 Task 2b: name the blast radius (count) for the inherited-subject edits below — a
  // subject correction reaches every recording day this animal owns, not just this one.
  const animalDayCount = getAnimalDayIds(animal).length;
  const experimenters = getAnimalExperimenters(animal);
  const experimenterNames = getExperimenterNames(animal);
  const keywords = getDayKeywords(day);
  const dayDateKey = String(day.date ?? '').replace(/-/g, '');

  const [fieldErrors, setFieldErrors] = useState<Record<string, { message: string } | null>>({});
  // Write-only: the setter drives the species-repair validation flow (below); the value itself
  // is never read, so it's left unbound to avoid an unused-var warning while preserving behavior.
  const [, setValidatingField] = useState<string | null>(null);
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
  const [seenFocusToken, setSeenFocusToken] = useState<number | null>(null);
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
  const handleBlur = useCallback(async (fieldPath: string, value: string) => {
    setValidatingField(fieldPath);

    // 1. Update store (auto-save)
    onFieldUpdate(fieldPath, value);

    // 2. Validate the just-edited value at its exported path
    try {
      const validatePath = fieldPath.startsWith('session.')
        ? fieldPath.slice('session.'.length)
        : fieldPath;
      // mergedDay is null on the merge-failed fail-closed path (corrupt animal config);
      // clone a safe `{}` so a blur-time validation can't throw on a null dereference.
      const patched = structuredClone(mergedDay || {}) as Record<string, unknown>;
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

  // Breadcrumb items. The top crumb is the WORKSPACE (the new-model home / animal list), not the
  // orphaned `#/home` page or the legacy form — keep the in-app trail inside the new model.
  const breadcrumbItems = [
    { label: 'Workspace', href: '#/workspace' },
    { label: `Animal: ${ownerKey}`, href: `#/animal/${ownerKey}/days` },
    { label: `Day: ${day.date}` },
  ];

  return (
    <div className="overview-step">
      {/* Breadcrumb Navigation */}
      <Breadcrumb items={breadcrumbItems} />

      <MalformedCollectionNotice
        // A clean `Day` is a valid possibly-corrupt-record input to this tolerant reader (it
        // detects non-array collections); the interface lacks an index signature, hence the cast.
        day={day as unknown as Record<string, unknown>}
        fields={OVERVIEW_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

      {/* A malformed (non-record) session loses its read-only, derived session_id and
          dead-ends (the field can't be re-entered). Surface an executable "Reset session"
          that restores the canonical session_id. The day array collections above are owned
          by MalformedCollectionNotice; this banner owns only the session record. */}
      <RawCorruptionBanner day={day} fields={['session']} onRepair={onRepair} />

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
            value={session.session_id}
            helpText={`Auto-generated from animal ID and date: ${ownerKey}_${dayDateKey}`}
          />

          <div className="form-field">
            <label htmlFor="session-description" className="required">
              Session Description
            </label>
            <textarea
              id="session-description"
              name="session.session_description"
              data-field-path="session_description"
              rows={3}
              defaultValue={session.session_description}
              onBlur={(e) => handleBlur('session.session_description', e.target.value)}
              className={fieldErrors['session.session_description'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.session_description']}
              aria-describedby={
                fieldErrors['session.session_description'] ? 'session-description-error' : undefined
              }
              required
              aria-required="true"
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
              rows={3}
              defaultValue={session.experiment_description || animal.experiment_description || ''}
              onBlur={(e) => handleBlur('session.experiment_description', e.target.value)}
              placeholder="e.g., Chronic tetrode recording during spatial navigation"
              className={fieldErrors['session.experiment_description'] ? 'invalid' : ''}
              aria-invalid={!!fieldErrors['session.experiment_description']}
              required
              aria-required="true"
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

          {/* Phase 8.7 Task 2.5: weight is a RECORDING-DAY fact for export. The Day Overview is
              the primary review/edit surface for the exported session weight — it writes
              `session.weight` (the merge prefers it over the animal baseline). An animal-created
              weight is only an initial/fallback value, labelled as such and confirmable here; it
              is no longer silently reused as the normal exported value for every day, and editing
              the day weight no longer mutates the shared animal record. */}
          <div className="form-field">
            <label htmlFor="session-weight">Recording-day weight (grams)</label>
            <input
              id="session-weight"
              type="number"
              min="0"
              step="any"
              name="session.weight"
              data-field-path="session.weight"
              key={`session-weight-${session.weight ?? ''}`}
              defaultValue={session.weight ?? ''}
              aria-describedby="session-weight-help"
              placeholder={
                typeof subject.weight === 'number'
                  ? `${subject.weight} (animal baseline)`
                  : 'e.g. 450'
              }
              onBlur={(e) => {
                // Guard against NaN reaching state from a partially-valid number entry — write
                // undefined (the fallback) rather than a NaN weight on the primary export path.
                const value = e.target.valueAsNumber;
                onFieldUpdate('session.weight', Number.isFinite(value) ? value : undefined);
              }}
            />
            <span id="session-weight-help" className="field-help-text">
              {session.weight !== undefined
                ? 'Weight recorded for this session — the value exported for this day.'
                : typeof subject.weight === 'number'
                  ? `No weight set for this day — the animal baseline (${subject.weight} g) will be `
                    + `exported as a fallback. Enter this session's weight to set it for this day.`
                  : 'Enter the weight recorded for this session (exported for this day).'}
            </span>
          </div>

          <KeywordsEditor
            value={keywords}
            onChange={(keywords) => onFieldUpdate('keywords', keywords)}
          />
        </div>
      </section>

      {/* Per-day technical parameters (default header path + units) live on
          day.technical, where the export reads them. */}
      <DayTechnicalSection
        technical={day.technical}
        onFieldUpdate={onFieldUpdate}
        recordingSystemDefaults={animal?.technicalDefaults}
        animalKey={ownerKey}
      />

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
          <span className="inherited-metadata-badge">Updates all days</span>
        </button>

        {showInherited && (
          <div id="inherited-metadata-content" className="inherited-metadata-content">
            {/* Subject Information. Identity fields are read-only; the constant subject facts a
                recording-day scientist commonly needs to repair (date of birth, species,
                description) are editable here and write through to the animal so existing animals
                can be fixed without leaving the day. Weight is NOT here — it is a recording-day
                fact edited in Session Metadata above (Phase 8.7 Task 2.5). */}
            <div className="inherited-section">
              <h3>Subject Information</h3>
              <div className="inherited-notice">
                Inherited from Animal — editing these fields updates the animal record
                shared by all {animalDayCount} recording day{animalDayCount === 1 ? '' : 's'},
                including any already exported.
                <a href={`#/animal/${ownerKey}/days`}>Edit Animal</a>
              </div>

              <div className="form-grid">
                <ReadOnlyField label="Subject ID" value={subject.subject_id} />
                <ReadOnlyField label="Sex" value={subject.sex} />
                <ReadOnlyField label="Genotype" value={subject.genotype} />

                <div className="form-field">
                  <label htmlFor="subject-date-of-birth">Date of Birth</label>
                  <input
                    id="subject-date-of-birth"
                    type="date"
                    data-field-path="subject.date_of_birth"
                    key={subject.date_of_birth || ''}
                    defaultValue={(subject.date_of_birth || '').split('T')[0]}
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
                  <label htmlFor="subject-species">Species</label>
                  <input
                    id="subject-species"
                    type="text"
                    data-field-path="subject.species"
                    key={`species-${subject.species || ''}`}
                    defaultValue={subject.species || ''}
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
                    key={`desc-${subject.description || ''}`}
                    defaultValue={subject.description || ''}
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
                <a href={`#/animal/${ownerKey}/days`}>Edit Animal</a>
              </div>

              <div className="form-grid">
                <ReadOnlyField
                  label="Names"
                  value={experimenterNames.join(', ')}
                />
                <ReadOnlyField
                  label="Lab"
                  value={experimenters.lab}
                />
                <ReadOnlyField
                  label="Institution"
                  value={experimenters.institution}
                />
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

