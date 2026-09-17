import { useState, useCallback, useMemo, useEffect } from 'react';
import Button from '../../components/ui/Button';
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
  const usualTeam = getAnimalExperimenters(animal).experimenter_name;
  const usualNames = Array.isArray(usualTeam) ? usualTeam : [];
  const teamException = teamNames.join(';') !== usualNames.join(';');
  const [teamOpen, setTeamOpen] = useState(teamNames.length === 0);
  useEffect(() => {
    if (props.focusRequest?.fieldPath.includes('experimenter_name')) setTeamOpen(true);
  }, [props.focusRequest]);
  const keywords = getDayKeywords(day);
  const dayDateKey = String(day.date ?? '').replace(/-/g, '');
  const draftKey = (fieldPath: string) => `day:${String(day.id)}:${fieldPath}`;

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
          <p className="daily-setup-lede">Enter this recording’s measurement, then review its epochs and files. Changes save automatically.</p>
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

          <details className="daily-log-context" open={teamNames.length === 0 || teamOpen || undefined}>
            <summary>
              People &amp; copied settings · {teamNames.length === 0 ? 'experimenters to enter' : teamException ? 'team differs today' : 'usual team'}
            </summary>
            <DayProvenanceLine
              animal={animal}
              day={day}
              onChangeSource={animalDays.length > 1 ? () => setChangeSourceOpen(true) : undefined}
              onChangeSetup={onGoToRecordingSetup}
            />
            <div className="daily-log-team-summary">
              <div>
                <h3>Experimenters present</h3>
                <p>{teamNames.join('; ') || 'No experimenters entered'}</p>
              </div>
              {teamNames.length > 0 && (
                <Button variant="secondary" size="small" onClick={() => setTeamOpen((open) => !open)}>
                  {teamOpen ? 'Hide team editor' : 'Change for this day'}
                </Button>
              )}
            </div>
            {(teamOpen || teamNames.length === 0) && (
              <div className="form-field">
                <label htmlFor="day-team-names" className="required">
                  Experimenters present (one per line, &quot;Last, First&quot;)
                </label>
                <DraftTextArea
                  draftKey={draftKey('experimenters.experimenter_name')}
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
            )}
          </details>

          <details className="daily-setup-group daily-log-more" open={!session.experiment_description || undefined}>
            <summary className="inherited-metadata-toggle">
              <span className="toggle-icon" aria-hidden="true">▶</span>
              Experiment description{session.experiment_description ? ' · inherited for this recording' : ' · required'}
            </summary>
            <div className="daily-setup-stack">
              <div className="form-grid daily-setup-description-grid">
                <div className="form-field">
                  <label htmlFor="experiment-description" className="required">
                    Experiment Description
                  </label>
                  <DraftTextArea
                    draftKey={draftKey('session.experiment_description')}
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

            </div>
          </details>

          <details className="daily-setup-group daily-log-more">
            <summary className="inherited-metadata-toggle">
              <span className="toggle-icon" aria-hidden="true">▶</span>
              Lab, institution &amp; optional search terms
            </summary>
            <div className="daily-setup-stack">
              <div className="daily-setup-secondary-grid">
                <div className="daily-setup-group">
                  <div className="daily-setup-group-header"><h3>Search terms</h3></div>
                  <KeywordsEditor value={keywords} onChange={(next) => onFieldUpdate('keywords', next)} />
                </div>
              </div>
              <div className="form-grid daily-setup-description-grid">
                <div className="form-field">
                  <label htmlFor="day-team-lab">Lab</label>
                  <DraftTextInput draftKey={draftKey('experimenters.lab')} id="day-team-lab" type="text"
                    name="experimenters.lab" data-field-path="lab" value={team.lab ?? ''}
                    onCommit={(value) => commitTeam({ lab: value })} />
                </div>
                <div className="form-field">
                  <label htmlFor="day-team-institution">Institution</label>
                  <DraftTextInput draftKey={draftKey('experimenters.institution')} id="day-team-institution" type="text"
                    name="experimenters.institution" data-field-path="institution" value={team.institution ?? ''}
                    onCommit={(value) => commitTeam({ institution: value })} />
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
