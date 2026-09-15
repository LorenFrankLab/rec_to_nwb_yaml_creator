import { useState, useCallback, useMemo } from 'react';
import ReadOnlyField from './ReadOnlyField';
import KeywordsEditor from './KeywordsEditor';
import MalformedCollectionNotice from './MalformedCollectionNotice';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import TasksFilesSection from './TasksFilesSection';
import DayProvenanceLine from './DayProvenanceLine';
import ChangeSourceDialog from './ChangeSourceDialog';
import { validateField } from './validation';
import { RAW_DAY_ARRAY_FIELDS } from '../../validation/rawShape';
import {
  getDaySession,
  getDayKeywords,
  getAnimalSubject,
  getAnimalExperimenters,
} from '../../state/workspaceSelectors';
import { previousWeightSuggestion } from '../../domain/dayCarryPolicy';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { FieldValueViewModel } from '../../viewModels/types';
import type { ExperimenterInfo } from '../../state/workspaceTypes';
import { pluralize } from '../../utils/pluralize';
import { DraftTextInput, DraftTextArea, DraftNumberInput } from '../../components/ui/DraftFields';
import Button from '../../components/ui/Button';

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
 * Order follows what changes every day: the recording date (the frame title), this day's measured
 * weight (with the previous measurement as a DATED suggestion, never pre-filled), the actual team,
 * then the epoch sequence editor. A provenance line states what the day was started from and which
 * probe setup applies ("Started from Jun 22 · Probe setup v1 · Rig …"), with a way to change the
 * source or the setup. The descriptions, data folder and search terms — which rarely change day to
 * day — sit in a collapsible group below, and the read-only animal context below that.
 *
 * Every free-text field is a draft-tracked control (typed text is visible to autosave / Ctrl+S /
 * the unload guard); validation runs on blur.
 */
export default function DayTab(props: DayTabProps) {
  // The shared day bundle comes from DayEditorContext in the Day Editor (an isolated render
  // passes the same fields as props). Section-specific props stay direct.
  const { animal, day, mergedDay, onFieldUpdate, animalDays = [], actions, animalKey = undefined } =
    useDayEditorContext(props);
  const { onRepair, onGoToRecordingSetup } = props;
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
  // The DAY's team (copied at creation / import); the animal's is only the default for new days.
  const team: ExperimenterInfo =
    day?.experimenters && typeof day.experimenters === 'object'
      ? getAnimalExperimenters({ experimenters: day.experimenters })
      : getAnimalExperimenters(animal);
  const teamNames = Array.isArray(team.experimenter_name) ? team.experimenter_name.map(String) : [];
  const keywords = getDayKeywords(day);
  const dayDateKey = String(day.date ?? '').replace(/-/g, '');

  const fieldsByPath = new Map((props.overviewFields ?? []).map((field) => [field.fieldPath, field]));
  const overviewField = (path: string) => fieldsByPath.get(path);

  // The previous measurement (or the setup baseline) as a dated suggestion — never pre-filled.
  const suggestion = useMemo(
    () => previousWeightSuggestion(animal, animalDays ?? [], String(day.date ?? '')),
    [animal, animalDays, day.date]
  );

  const [fieldErrors, setFieldErrors] = useState<Record<string, { message: string } | null>>({});
  const [changeSourceOpen, setChangeSourceOpen] = useState(false);

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

  const weightHelp =
    overviewField('session.weight')?.helpText ??
    (session.weight !== undefined
      ? 'Weight measured on this day — the value exported for this day.'
      : 'No weight entered for this day — required for export.');

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
          <DayProvenanceLine
            animal={animal}
            day={day}
            onChangeSource={animalDays.length > 1 ? () => setChangeSourceOpen(true) : undefined}
            onChangeSetup={onGoToRecordingSetup}
          />
        </div>

        <div className="daily-setup-stack">
          <div className="daily-log-primary-grid">
            <div className="daily-setup-group daily-setup-group-primary">
              <div className="daily-setup-group-header">
                <h3>Weight</h3>
              </div>
              <div className="form-field">
                <label htmlFor="session-weight" className="required">
                  Weight measured today (grams)
                </label>
                <div className="daily-log-weight-row">
                  <DraftNumberInput
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
                  {session.weight === undefined && suggestion && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onFieldUpdate('session.weight', suggestion.weight)}
                      aria-label={`Use ${suggestion.weight} grams (${
                        suggestion.source === 'previous-day' ? `measured ${suggestion.date}` : 'the baseline at setup'
                      }) as today's weight`}
                    >
                      Use {suggestion.weight} g
                    </Button>
                  )}
                </div>
                <span id="session-weight-help" className="field-help-text">
                  {session.weight === undefined && suggestion
                    ? suggestion.source === 'previous-day'
                      ? `Previous measurement: ${suggestion.weight} g on ${suggestion.date}. Enter today’s measurement — the previous value is a suggestion, not a measurement.`
                      : `Baseline at setup: ${suggestion.weight} g. Enter today’s measurement.`
                    : weightHelp}
                </span>
              </div>
            </div>

            <div className="daily-setup-group daily-setup-group-primary">
              <div className="daily-setup-group-header">
                <h3>Team</h3>
              </div>
              <div className="form-field">
                <label htmlFor="day-team-names" className="required">
                  Experimenters present (one per line, &quot;Last, First&quot;)
                </label>
                <DraftTextArea
                  id="day-team-names"
                  name="experimenters.experimenter_name"
                  data-field-path="experimenter_name"
                  rows={Math.min(6, Math.max(2, teamNames.length + 1))}
                  value={teamNames.join('\n')}
                  onCommit={(text) =>
                    commitTeam({
                      experimenter_name: text
                        .split('\n')
                        .map((n) => n.trim())
                        .filter((n) => n !== ''),
                    })
                  }
                  aria-describedby="day-team-help"
                  aria-required="true"
                />
                <span id="day-team-help" className="field-help-text">
                  {day?.provenance?.fields?.experimenters === 'copied' && day.provenance.copiedFromDate
                    ? `Copied from ${day.provenance.copiedFromDate}; edit for this day only.`
                    : 'This day’s actual team. Changing it here affects this day only.'}
                </span>
              </div>
            </div>
          </div>

          {/* The epoch sequence editor — the same component as the Tasks & Files section. */}
          <div className="daily-log-epochs">
            <TasksFilesSection {...props} focusRequest={props.focusRequest ?? null} />
          </div>

          <details className="daily-setup-group daily-log-more">
            <summary className="inherited-metadata-toggle">
              <span className="toggle-icon" aria-hidden="true">▶</span>
              Descriptions, data folder &amp; search terms
            </summary>
            <div className="daily-setup-stack">
              <div className="form-grid daily-setup-description-grid">
                <div className="form-field">
                  <label htmlFor="session-description" className="required">
                    Session Description
                  </label>
                  <DraftTextArea
                    id="session-description"
                    name="session.session_description"
                    data-field-path="session_description"
                    rows={3}
                    value={session.session_description ?? ''}
                    onCommit={(value) => onFieldUpdate('session.session_description', value)}
                    onBlurValue={(value) => handleBlur('session.session_description', value)}
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
                  <DraftTextArea
                    id="experiment-description"
                    name="session.experiment_description"
                    data-field-path="experiment_description"
                    rows={3}
                    value={session.experiment_description ?? ''}
                    onCommit={(value) => onFieldUpdate('session.experiment_description', value)}
                    onBlurValue={(value) => handleBlur('session.experiment_description', value)}
                    placeholder="e.g., Chronic tetrode recording during spatial navigation"
                    className={fieldErrors['session.experiment_description'] ? 'invalid' : ''}
                    aria-invalid={!!fieldErrors['session.experiment_description']}
                    required
                    aria-required="true"
                  />
                  <span className="field-help-text">
                    {overviewField('session.experiment_description')?.helpText ??
                      'Describes the overall experiment. Required for export and written to the NWB file.'}
                  </span>
                  {!session.experiment_description && animal.experiment_description && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onFieldUpdate('session.experiment_description', animal.experiment_description)}
                    >
                      Use the animal default
                    </Button>
                  )}
                  {fieldErrors['session.experiment_description'] && (
                    <span className="validation-error" role="alert">
                      {fieldErrors['session.experiment_description'].message}
                    </span>
                  )}
                </div>
              </div>

              <div className="daily-setup-secondary-grid">
                <div className="daily-setup-group">
                  <div className="daily-setup-group-header">
                    <h3>File location</h3>
                  </div>
                  <div className="form-field">
                    <label htmlFor="day-data-folder">Data folder</label>
                    <DraftTextInput
                      id="day-data-folder"
                      type="text"
                      name="dataFolder"
                      data-field-path="dataFolder"
                      value={day.dataFolder ?? ''}
                      onCommit={(value) => onFieldUpdate('dataFolder', value)}
                      placeholder="e.g. /stelmo/denisse/Laurent/20260514/"
                      aria-describedby="day-data-folder-help"
                    />
                    <span id="day-data-folder-help" className="field-help-text">
                      Where this day&apos;s files live. Epoch file names derive inside it.
                      {day?.provenance?.fields?.dataFolder === 'derived' && day.provenance.copiedFromDate
                        ? ` Derived from ${day.provenance.copiedFromDate}’s folder with today’s date.`
                        : ''}
                    </span>
                  </div>
                </div>

                <div className="daily-setup-group">
                  <div className="daily-setup-group-header">
                    <h3>Search terms</h3>
                  </div>
                  <KeywordsEditor value={keywords} onChange={(next) => onFieldUpdate('keywords', next)} />
                </div>
              </div>

              <div className="form-grid daily-setup-description-grid">
                <div className="form-field">
                  <label htmlFor="day-team-lab">Lab</label>
                  <DraftTextInput
                    id="day-team-lab"
                    type="text"
                    name="experimenters.lab"
                    data-field-path="lab"
                    value={team.lab ?? ''}
                    onCommit={(value) => commitTeam({ lab: value })}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="day-team-institution">Institution</label>
                  <DraftTextInput
                    id="day-team-institution"
                    type="text"
                    name="experimenters.institution"
                    data-field-path="institution"
                    value={team.institution ?? ''}
                    onCommit={(value) => commitTeam({ institution: value })}
                  />
                </div>
              </div>
            </div>
          </details>
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
            Subject facts are animal-wide. They are shown here for review and edited from the animal profile.
            <a href={`#/animal/${ownerKey}/days?field=subject.species`}>Edit animal setup</a>
          </div>

          <div className="form-grid read-only-summary-grid">
            <ReadOnlyField
              label="Session ID"
              value={overviewField('session.session_id')?.value ?? session.session_id}
              helpText={
                overviewField('session.session_id')?.helpText ??
                `Auto-generated from animal ID and date: ${ownerKey}_${dayDateKey}`
              }
            />
            <ReadOnlyField label="Subject ID" value={overviewField('subject.subject_id')?.value ?? subject.subject_id} />
            <ReadOnlyField label="Species" value={overviewField('subject.species')?.value ?? subject.species} />
            <ReadOnlyField label="Sex" value={overviewField('subject.sex')?.value ?? subject.sex} />
            <ReadOnlyField label="Genotype" value={overviewField('subject.genotype')?.value ?? subject.genotype} />
            <ReadOnlyField
              label="Date of Birth"
              value={overviewField('subject.date_of_birth')?.value ?? subject.date_of_birth}
            />
            <ReadOnlyField
              label="Subject Description"
              value={overviewField('subject.description')?.value ?? subject.description}
            />
          </div>
        </div>
      </details>

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
