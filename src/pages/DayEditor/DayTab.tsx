import { useState, useCallback } from 'react';
import ReadOnlyField from './ReadOnlyField';
import KeywordsEditor from './KeywordsEditor';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import { validateField } from './validation';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getDaySession,
  getDayKeywords,
  getAnimalSubject,
  getAnimalExperimenters,
  getExperimenterNames,
} from '../../state/workspaceSelectors';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { FieldValueViewModel } from '../../viewModels/types';

interface DayTabProps extends DayEditorBundle {
  /** A repair request focusing a field in this section. */
  focusRequest?: { fieldPath?: string; token?: number } | null;
  /** Executes an issue's `repairCommand` in place (resets a malformed session record). */
  onRepair?: (issue: unknown) => void;
  /**
   * The day-editor view-model's Overview field slice (`vm.overview.fields`). The frame passes it so
   * the DISPLAYED inherited/default/derived values, help text, and the weight placeholder render
   * from the view-model; an isolated render that omits it falls back to deriving the same values
   * inline (so the rendered output is identical either way).
   */
  overviewFields?: FieldValueViewModel[];
}

// The day-owned collections this tab owns (raw-shape reset surface).
const OVERVIEW_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'overview');

/**
 * DayTab — the day editor's Daily Setup section (folded from the former Overview + files/weight
 * surfaces).
 *
 * Day-specific setup metadata: the off-export data folder, recording-day weight,
 * session/experiment descriptions, and keywords. The derived session id and inherited animal facts
 * are still available, but collapsed into context so the first screen stays focused on what changed
 * for this recording day.
 *
 * The Workspace › Animal › Day breadcrumb now lives in the frame header (DayEditorFrame), not here,
 * so a single breadcrumb is shared across all sections.
 *
 * UX Philosophy:
 * - Show what matters: the fields a user most often changes for this recording day
 * - Keep inherited subject/team facts read-only, with animal-wide edits kept on AnimalView
 */
export default function DayTab(props: DayTabProps) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). Section-specific props stay direct.
  const { animal, day, mergedDay, onFieldUpdate, animalKey = undefined } = useDayEditorContext(props);
  const { onRepair } = props;
  // The store OWNER KEY (resolved by DayEditorFrame). Animal-editor links and the derived
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
  const experimenters = getAnimalExperimenters(animal);
  const experimenterNames = getExperimenterNames(animal);
  const keywords = getDayKeywords(day);
  const dayDateKey = String(day.date ?? '').replace(/-/g, '');

  // Phase 3-e: the Overview field view-model, keyed by field path. The DayEditorFrame passes
  // `vm.overview.fields`; an isolated render omits it, so each `overviewField(path)?.x ?? inline`
  // below prefers the view-model when present and falls back to the identical inline derivation
  // otherwise. The view-model supplies DISPLAY only (read-only values, help text, the weight
  // placeholder) — the editable inputs keep their day-owned `defaultValue` so the merge's effective
  // value (e.g. the inherited animal-baseline weight) never silently pre-fills a day-owned input.
  const fieldsByPath = new Map((props.overviewFields ?? []).map((field) => [field.fieldPath, field]));
  const overviewField = (path: string) => fieldsByPath.get(path);

  const [fieldErrors, setFieldErrors] = useState<Record<string, { message: string } | null>>({});
  // Write-only: blur-time validation toggles this transient state; the value itself is never read.
  const [, setValidatingField] = useState<string | null>(null);

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

  // The Workspace › Animal › Day breadcrumb is rendered ONCE by the frame header (DayEditorFrame),
  // not per-section, so a single breadcrumb is shared across the rail.

  return (
    <div className="overview-step">
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

      {/* Daily setup metadata (day-specific editable fields) */}
      <section className="day-editor-section">
        <h2>Daily Setup</h2>

        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="day-data-folder">Data folder</label>
            <input
              id="day-data-folder"
              type="text"
              name="dataFolder"
              data-field-path="dataFolder"
              key={`day-data-folder-${day.dataFolder ?? ''}`}
              defaultValue={day.dataFolder ?? ''}
              placeholder="e.g. /stelmo/denisse/Laurent/20260514/"
              aria-describedby="day-data-folder-help"
              onBlur={(e) => onFieldUpdate('dataFolder', e.target.value)}
            />
            <span id="day-data-folder-help" className="field-help-text">
              Where this day&apos;s files live. Epoch file names derive inside it and the value is
              carried forward to the next day.
            </span>
          </div>

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
                overviewField('session.weight')?.fallbackValue
                ?? (typeof subject.weight === 'number'
                  ? `${subject.weight} (animal baseline)`
                  : 'e.g. 450')
              }
              onBlur={(e) => {
                const value = e.target.valueAsNumber;
                onFieldUpdate('session.weight', Number.isFinite(value) ? value : undefined);
              }}
            />
            <span id="session-weight-help" className="field-help-text">
              {overviewField('session.weight')?.helpText
                ?? (session.weight !== undefined
                  ? 'Weight recorded for this session — the value exported for this day.'
                  : typeof subject.weight === 'number'
                    ? `No weight set for this day — the animal baseline (${subject.weight} g) will be `
                      + `exported as a fallback. Enter this session's weight to set it for this day.`
                    : 'Enter the weight recorded for this session (exported for this day).')}
            </span>
          </div>

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
              {overviewField('session.experiment_description')?.helpText
                ?? 'Describes the overall experiment. Required for export and written to the NWB file.'}
            </span>
            {fieldErrors['session.experiment_description'] && (
              <span className="validation-error" role="alert">
                {fieldErrors['session.experiment_description'].message}
              </span>
            )}
          </div>

          <KeywordsEditor
            value={keywords}
            onChange={(keywords) => onFieldUpdate('keywords', keywords)}
          />
        </div>
      </section>

      <details className="day-editor-section inherited-metadata-section">
        <summary className="inherited-metadata-toggle">
          <span className="toggle-icon" aria-hidden="true">▶</span>
          Session identity and animal context
          <span className="inherited-metadata-badge">read-only</span>
        </summary>
        <div className="inherited-metadata-content">
          <div className="inherited-notice">
            Subject facts and experimenter metadata are animal-wide. They are shown here for review
            and edited from the animal profile.
            <a href={`#/animal/${ownerKey}/days?field=subject.species`}>Edit animal setup</a>
          </div>

          <div className="form-grid read-only-summary-grid">
          <ReadOnlyField
            label="Session ID"
            value={overviewField('session.session_id')?.value ?? session.session_id}
            helpText={
              overviewField('session.session_id')?.helpText
              ?? `Auto-generated from animal ID and date: ${ownerKey}_${dayDateKey}`
            }
          />
          <ReadOnlyField
            label="Subject ID"
            value={overviewField('subject.subject_id')?.value ?? subject.subject_id}
          />
          <ReadOnlyField
            label="Species"
            value={overviewField('subject.species')?.value ?? subject.species}
          />
          <ReadOnlyField label="Sex" value={overviewField('subject.sex')?.value ?? subject.sex} />
          <ReadOnlyField
            label="Genotype"
            value={overviewField('subject.genotype')?.value ?? subject.genotype}
          />
          <ReadOnlyField
            label="Date of Birth"
            value={overviewField('subject.date_of_birth')?.value ?? subject.date_of_birth}
          />
          <ReadOnlyField
            label="Subject Description"
            value={overviewField('subject.description')?.value ?? subject.description}
          />
          <ReadOnlyField
            label="Names"
            value={
              overviewField('experimenters.experimenter_name')?.value
              ?? experimenterNames.join(', ')
            }
          />
          <ReadOnlyField
            label="Lab"
            value={overviewField('experimenters.lab')?.value ?? experimenters.lab}
          />
          <ReadOnlyField
            label="Institution"
            value={overviewField('experimenters.institution')?.value ?? experimenters.institution}
          />
          </div>
        </div>
      </details>
    </div>
  );
}
