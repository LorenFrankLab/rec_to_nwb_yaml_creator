import { useState, useCallback, useMemo, useEffect } from 'react';
import Button from '../../components/ui/Button';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import TasksFilesSection from './TasksFilesSection';
import ChangeSourceDialog from './ChangeSourceDialog';
import DaySettingsDialog, { isDaySettingsFieldPath } from './DaySettingsDialog';
import { validateField } from './validation';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getDaySession,
  getDayKeywords,
  getAnimalExperimenters,
} from '../../state/workspaceSelectors';
import { previousWeightSuggestion } from '../../domain/dayCarryPolicy';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { FieldValueViewModel } from '../../viewModels/types';
import type { ExperimenterInfo } from '../../state/workspaceTypes';
import { pluralize } from '../../utils/pluralize';
import { DraftTextArea, DraftNumberInput } from '../../components/ui/DraftFields';

interface DayTabProps extends DayEditorBundle {
  /** A repair request focusing a field in this section (or the embedded epoch editor). */
  focusRequest?: { fieldPath: string; token: number } | null;
  /** Executes an issue's `repairCommand` in place (resets a malformed session record). */
  onRepair?: (issue: unknown) => void;
  /**
   * The day-editor view-model's Overview field slice (`vm.overview.fields`). The frame passes it so
   * the DISPLAYED derived values and help text render from the view-model; an isolated render that
   * omits it falls back to deriving the same values inline.
   */
  overviewFields?: FieldValueViewModel[];
  /** Switch to the Recording Setup section (the provenance line's "Change setup"). */
  onGoToRecordingSetup?: () => void;
}

// The day-owned collections this tab owns (raw-shape reset surface).
const OVERVIEW_STEP_COLLECTIONS = RAW_DAY_ARRAY_FIELDS.filter((f) => f.repairStep === 'overview');

/**
 * DayTab — the day editor's first screen: the compact daily log.
 *
 * Order follows what changes every day: this day's measured weight (with the previous measurement
 * as a dated suggestion, never pre-filled), recording notes, then the epoch sequence and files.
 * Rare day-level exceptions remain available in Day settings without occupying the routine flow.
 *
 * Every free-text field is a draft-tracked control (typed text is visible to autosave / Ctrl+S /
 * the unload guard); validation runs on blur.
 */
export default function DayTab(props: DayTabProps) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). Section-specific props stay direct.
  const { animal, day, mergedDay, onFieldUpdate, animalDays = [], actions } =
    useDayEditorContext(props);
  const { onRepair, onGoToRecordingSetup } = props;
  // Tolerate corrupt persisted state: a malformed (null/scalar) `day.session`,
  // `animal.subject`, or `animal.experimenters` must not crash the editor on a raw
  // dereference. Read through the canonical shape-safe selectors (the single place these
  // guards live), so a corrupt record renders blank fields the user can fix, never a
  // blank/crashed step.
  const session = getDaySession(day);
  // The DAY's team (copied at creation / import); the animal's is only the default for new days.
  const team: ExperimenterInfo =
    day?.experimenters && typeof day.experimenters === 'object'
      ? getAnimalExperimenters({ experimenters: day.experimenters })
      : getAnimalExperimenters(animal);
  const keywords = getDayKeywords(day);
  const draftKey = (fieldPath: string) => `day:${String(day.id)}:${fieldPath}`;

  const fieldsByPath = new Map((props.overviewFields ?? []).map((field) => [field.fieldPath, field]));
  const overviewField = (path: string) => fieldsByPath.get(path);

  // The previous measurement (or the setup baseline) as a dated suggestion — never pre-filled.
  const suggestion = useMemo(
    () => previousWeightSuggestion(animal, animalDays ?? [], String(day.date ?? '')),
    [animal, animalDays, day.date]
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, { message: string } | null>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [changeSourceOpen, setChangeSourceOpen] = useState(false);

  useEffect(() => {
    if (props.focusRequest && isDaySettingsFieldPath(props.focusRequest.fieldPath)) {
      setSettingsOpen(true);
    }
  }, [props.focusRequest]);

  // Validation-on-blur. The COMMIT is the draft field's job (debounced while typing, on blur, on
  // Ctrl/Cmd+S) — this only validates the final value at its exported path.
  const handleBlur = useCallback(async (fieldPath: string, value: string) => {
    try {
      const validatePath = fieldPath.startsWith('session.')
        ? fieldPath.slice('session.'.length)
        : fieldPath;
      const patched = structuredClone(mergedDay || {}) as Record<string, unknown>;
      patched[validatePath] = value;
      const { valid, errors } = await validateField(patched, validatePath);
      setFieldErrors((prev) => ({ ...prev, [fieldPath]: valid ? null : errors[0] }));
    } catch (error) {
      console.error('Validation error:', error);
      setFieldErrors((prev) => ({ ...prev, [fieldPath]: { message: 'Validation failed - please try again' } }));
    }
  }, [mergedDay]);

  const errorCount = Object.values(fieldErrors).filter(Boolean).length;

  const commitTeam = (patch: Partial<ExperimenterInfo>) => {
    onFieldUpdate('experimenters', { ...team, ...patch });
  };

  const reseedFrom = (sourceDayId: string) => {
    const reseed = (actions as { reseedDayFrom?: (dayId: string, sourceId: string) => void }).reseedDayFrom;
    if (reseed) reseed(String(day.id), sourceDayId);
    setChangeSourceOpen(false);
  };

  const weightHelp = (() => {
    if (typeof session.weight === 'number' && Number.isFinite(session.weight)) {
      if (suggestion?.source === 'previous-day') {
        return `Saved for ${day.date}. Previous measurement: ${suggestion.weight} g on ${suggestion.date}.`;
      }
      if (suggestion?.source === 'animal-baseline') {
        return `Saved for ${day.date}. Baseline at setup: ${suggestion.weight} g.`;
      }
      return overviewField('session.weight')?.helpText ?? `Saved for ${day.date}.`;
    }
    if (suggestion?.source === 'previous-day') {
      return `Previous measurement: ${suggestion.weight} g on ${suggestion.date}. Enter the measurement for ${day.date}.`;
    }
    if (suggestion?.source === 'animal-baseline') {
      return `Baseline at setup: ${suggestion.weight} g. Enter the measurement for ${day.date}.`;
    }
    return overviewField('session.weight')?.helpText ?? 'No weight entered for this day — required for export.';
  })();

  return (
    <div className="overview-step">
      <MalformedCollectionNotice
        day={day as unknown as Record<string, unknown>}
        fields={OVERVIEW_STEP_COLLECTIONS}
        onReset={(key) => onFieldUpdate(key, [])}
      />

      {/* A malformed (non-record) session loses its read-only, derived session_id and dead-ends;
          surface an executable "Reset session". */}
      <RawCorruptionBanner day={day} fields={['session']} onRepair={onRepair} />

      {/* ARIA live region for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {errorCount > 0 && `${errorCount} validation ${pluralize(errorCount, 'error')}`}
      </div>

      <section className="day-editor-section daily-setup-section" aria-labelledby="daily-log-heading">
        <div className="daily-setup-header">
          <h2 id="daily-log-heading">Daily log</h2>
          <Button variant="secondary" size="small" onClick={() => setSettingsOpen(true)}>
            Day settings
          </Button>
            <p className="daily-setup-lede">Enter today’s measurements, then confirm the recording sequence and its files. Changes save automatically.</p>
        </div>

        <div className="daily-setup-stack">
          <section className="daily-log-today" aria-labelledby="daily-log-today-heading">
            <h3 id="daily-log-today-heading">Today</h3>
            <div className="daily-log-primary-grid">
              <div className="daily-setup-group daily-setup-group-primary">
                <div className="form-field">
                  <label htmlFor="session-weight" className="required">
                    Weight measured on {day.date} (grams)
                  </label>
                  <div className="daily-log-weight-row">
                    <DraftNumberInput
                      draftKey={draftKey('session.weight')}
                      id="session-weight"
                      min="0"
                      step="any"
                      name="session.weight"
                      data-field-path="session.weight"
                      value={typeof session.weight === 'number' ? session.weight : undefined}
                      onCommit={(value) => onFieldUpdate('session.weight', value)}
                      aria-describedby="session-weight-help"
                      aria-required="true"
                      placeholder="e.g. 450"
                    />
                  </div>
                  <span id="session-weight-help" className="field-help-text">
                    {weightHelp}
                  </span>
                </div>
              </div>
              <div className="daily-setup-group daily-setup-group-primary daily-log-notes">
                <div className="form-field">
                  <label htmlFor="session-description" className="required">
                    Recording notes
                  </label>
                  <DraftTextArea
                    draftKey={draftKey('session.session_description')}
                    id="session-description"
                    name="session.session_description"
                    data-field-path="session_description"
                    rows={3}
                    value={session.session_description ?? ''}
                    onCommit={(value) => onFieldUpdate('session.session_description', value)}
                    onBlurValue={(value) => handleBlur('session.session_description', value)}
                    className={fieldErrors['session.session_description'] ? 'invalid' : ''}
                    aria-invalid={!!fieldErrors['session.session_description']}
                    aria-describedby={fieldErrors['session.session_description']
                      ? 'session-description-help session-description-error'
                      : 'session-description-help'}
                    required
                    aria-required="true"
                  />
                  <span id="session-description-help" className="field-help-text">
                    Briefly describe this recording day. Saved as the NWB session description.
                  </span>
                  {fieldErrors['session.session_description'] && (
                    <span id="session-description-error" className="validation-error" role="alert">
                      {fieldErrors['session.session_description'].message}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* The epoch sequence editor — the same component as the Tasks & Files section. */}
          <div className="daily-log-epochs">
            <TasksFilesSection {...props} focusRequest={props.focusRequest ?? null} />
          </div>
        </div>
      </section>

      <DaySettingsDialog
        isOpen={settingsOpen}
        animal={animal}
        day={day}
        animalDays={animalDays}
        team={team}
        keywords={keywords}
        experimentDescription={session.experiment_description ?? ''}
        experimentDescriptionHelp={
          overviewField('session.experiment_description')?.helpText ??
          'Describes the overall experiment. Required for export and written to the NWB file.'
        }
        experimentDescriptionError={fieldErrors['session.experiment_description']}
        focusRequest={props.focusRequest}
        draftKey={draftKey}
        onClose={() => setSettingsOpen(false)}
        onTeamChange={commitTeam}
        onKeywordsChange={(next) => onFieldUpdate('keywords', next)}
        onExperimentDescriptionCommit={(value) => onFieldUpdate('session.experiment_description', value)}
        onExperimentDescriptionBlur={(value) => handleBlur('session.experiment_description', value)}
        onUseAnimalDefault={animal.experiment_description
          ? () => onFieldUpdate('session.experiment_description', animal.experiment_description)
          : undefined}
        onChangeSource={animalDays.length > 1 ? () => {
          setSettingsOpen(false);
          setChangeSourceOpen(true);
        } : undefined}
        onChangeSetup={onGoToRecordingSetup ? () => {
          setSettingsOpen(false);
          onGoToRecordingSetup();
        } : undefined}
      />

      <ChangeSourceDialog
        isOpen={changeSourceOpen}
        day={day}
        animalDays={animalDays}
        onConfirm={reseedFrom}
        onClose={() => setChangeSourceOpen(false)}
      />
    </div>
  );
}
