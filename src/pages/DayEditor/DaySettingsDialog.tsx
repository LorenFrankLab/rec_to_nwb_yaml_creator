import { useEffect, useRef, useState } from 'react';
import { Modal } from '../../components/Modal';
import Button from '../../components/ui/Button';
import { DraftTextArea, DraftTextInput } from '../../components/ui/DraftFields';
import type { Animal, Day, ExperimenterInfo } from '../../state/workspaceTypes';
import DayProvenanceLine from './DayProvenanceLine';
import DayTechnicalSection from './DayTechnicalSection';
import styles from './DaySettingsDialog.module.css';

interface FocusRequest {
  fieldPath: string;
  token: number;
}

interface DaySettingsDialogProps {
  isOpen: boolean;
  animal: Animal;
  day: Day;
  animalDays: Day[];
  team: ExperimenterInfo;
  experimentDescription: string;
  experimentDescriptionHelp: string;
  experimentDescriptionError?: { message: string } | null;
  focusRequest?: FocusRequest | null;
  draftKey: (fieldPath: string) => string;
  onClose: () => void;
  onTeamChange: (patch: Partial<ExperimenterInfo>) => void;
  onFieldUpdate: (path: string, value: unknown) => void;
  onExperimentDescriptionCommit: (value: string) => void;
  onExperimentDescriptionBlur: (value: string) => void;
  onUseAnimalDefault?: () => void;
  onChangeSource?: () => void;
  onChangeSetup?: () => void;
}

const SETTINGS_FIELDS = new Set([
  'experimenter_name',
  'experiment_description',
  'lab',
  'institution',
]);

const normalizedFieldPath = (fieldPath = '') =>
  fieldPath.replace(/^session\./, '').replace(/^experimenters\./, '');

/** Whether a Daily Log repair target belongs in the compact Day settings dialog. */
export const isDaySettingsFieldPath = (fieldPath: string): boolean =>
  SETTINGS_FIELDS.has(normalizedFieldPath(fieldPath)) || /^(?:technical\.)?(?:units(?:\.|$)|default_header_file_path$)/.test(fieldPath);

/** Rare day-level exceptions, kept out of the routine Daily Log. */
export default function DaySettingsDialog({
  isOpen,
  animal,
  day,
  animalDays,
  team,
  experimentDescription,
  experimentDescriptionHelp,
  experimentDescriptionError,
  focusRequest,
  draftKey,
  onClose,
  onTeamChange,
  onFieldUpdate,
  onExperimentDescriptionCommit,
  onExperimentDescriptionBlur,
  onUseAnimalDefault,
  onChangeSource,
  onChangeSetup,
}: DaySettingsDialogProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const wasOpenRef = useRef(false);
  const focusPath = normalizedFieldPath(focusRequest?.fieldPath);
  const focusIsStudyMetadata = ['experiment_description', 'lab', 'institution'].includes(focusPath);
  const [studyMetadataOpen, setStudyMetadataOpen] = useState(!experimentDescription);
  const [sourceOpen, setSourceOpen] = useState(false);
  const conversionFocus = /^(?:technical\.)?(?:units(?:\.|$)|default_header_file_path$)/.test(focusPath);
  const [conversionOpen, setConversionOpen] = useState(false);
  useEffect(() => { if (isOpen && conversionFocus) setConversionOpen(true); }, [isOpen, conversionFocus, focusRequest?.token]);

  useEffect(() => {
    const justOpened = isOpen && !wasOpenRef.current;
    wasOpenRef.current = isOpen;
    if (!justOpened) return;
    setStudyMetadataOpen(!experimentDescription || focusIsStudyMetadata);
    setSourceOpen(false);
  }, [experimentDescription, focusIsStudyMetadata, isOpen]);

  useEffect(() => {
    if (isOpen && focusIsStudyMetadata) setStudyMetadataOpen(true);
  }, [focusIsStudyMetadata, focusRequest?.token, isOpen]);

  useEffect(() => {
    if (!isOpen || !focusPath || !isDaySettingsFieldPath(focusPath)) return undefined;
    if (focusIsStudyMetadata && !studyMetadataOpen) return undefined;
    if (conversionFocus && !conversionOpen) return undefined;
    let secondFrame: number | undefined;
    let removeTimer: ReturnType<typeof setTimeout> | undefined;
    let target: HTMLElement | null | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        target = rootRef.current?.querySelector<HTMLElement>(`[data-field-path="${conversionFocus && !focusPath.startsWith('technical.') ? `technical.${focusPath}` : focusPath}"]`);
        target?.focus();
        target?.classList.add('repair-target-highlight');
        if (target) removeTimer = setTimeout(() => target?.classList.remove('repair-target-highlight'), 2000);
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame !== undefined) cancelAnimationFrame(secondFrame);
      if (removeTimer !== undefined) clearTimeout(removeTimer);
      target?.classList.remove('repair-target-highlight');
    };
  }, [focusIsStudyMetadata, focusPath, isOpen, studyMetadataOpen, conversionFocus, conversionOpen]);

  const teamNames = Array.isArray(team.experimenter_name) ? team.experimenter_name.map(String) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Day settings"
      titleId="day-settings-title"
      describedById="day-settings-description"
      className={styles.dialog}
      footer={<div className="form-actions"><Button onClick={onClose}>Done</Button></div>}
    >
      <div ref={rootRef}>
        <p id="day-settings-description" className={styles.intro}>
          These values normally carry forward. Change them only when this recording differs.
        </p>

        <section className={styles.section} aria-labelledby="day-settings-team-heading">
          <h3 id="day-settings-team-heading">Experimenters for this day</h3>
          <p className={styles.sectionHint}>One person per line, written as “Last, First”.</p>
          <div className="form-field">
            <label htmlFor="day-team-names" className="required">Experimenters present</label>
            <DraftTextArea
              draftKey={draftKey('experimenters.experimenter_name')}
              id="day-team-names"
              name="experimenters.experimenter_name"
              data-field-path="experimenter_name"
              rows={Math.min(6, Math.max(2, teamNames.length + 1))}
              value={teamNames.join('\n')}
              onCommit={(text) => onTeamChange({
                experimenter_name: text.split('\n').map((name) => name.trim()).filter(Boolean),
              })}
              aria-describedby="day-team-help"
              aria-required="true"
            />
            <span id="day-team-help" className="field-help-text">
              This changes the exported team for this day only.
            </span>
          </div>
        </section>

        <details
          className={styles.details}
          open={studyMetadataOpen}
          onToggle={(event) => setStudyMetadataOpen(event.currentTarget.open)}
        >
          <summary>Study metadata</summary>
          <div className={styles.detailsBody}>
            <p className={styles.sectionHint}>
              The experiment description, lab and institution normally come from animal setup.
            </p>
            <div className={styles.fields}>
              <div className={`form-field ${styles.fullWidth}`}>
                <label htmlFor="experiment-description" className="required">Experiment description</label>
                <DraftTextArea
                  draftKey={draftKey('session.experiment_description')}
                  id="experiment-description"
                  name="session.experiment_description"
                  data-field-path="experiment_description"
                  rows={3}
                  value={experimentDescription}
                  onCommit={onExperimentDescriptionCommit}
                  onBlurValue={onExperimentDescriptionBlur}
                  className={experimentDescriptionError ? 'invalid' : ''}
                  aria-invalid={!!experimentDescriptionError}
                  aria-describedby={experimentDescriptionError
                    ? 'experiment-description-help experiment-description-error'
                    : 'experiment-description-help'}
                  required
                  aria-required="true"
                />
                <span id="experiment-description-help" className="field-help-text">
                  {experimentDescriptionHelp}
                </span>
                {!experimentDescription && onUseAnimalDefault && (
                  <Button variant="secondary" size="small" onClick={onUseAnimalDefault}>
                    Use the animal default
                  </Button>
                )}
                {experimentDescriptionError && (
                  <span id="experiment-description-error" className="validation-error" role="alert">
                    {experimentDescriptionError.message}
                  </span>
                )}
              </div>

              <div className="form-field">
                <label htmlFor="day-team-lab">Lab</label>
                <DraftTextInput
                  draftKey={draftKey('experimenters.lab')}
                  id="day-team-lab"
                  type="text"
                  name="experimenters.lab"
                  data-field-path="lab"
                  value={team.lab ?? ''}
                  onCommit={(value) => onTeamChange({ lab: value })}
                />
              </div>
              <div className="form-field">
                <label htmlFor="day-team-institution">Institution</label>
                <DraftTextInput
                  draftKey={draftKey('experimenters.institution')}
                  id="day-team-institution"
                  type="text"
                  name="experimenters.institution"
                  data-field-path="institution"
                  value={team.institution ?? ''}
                  onCommit={(value) => onTeamChange({ institution: value })}
                />
              </div>
            </div>
          </div>
        </details>

        <details className={styles.details} open={conversionOpen}
          onToggle={(event) => setConversionOpen(event.currentTarget.open)}>
          <summary>Conversion metadata</summary>
          <div className={styles.detailsBody}>
            <DayTechnicalSection technical={day.technical} onFieldUpdate={onFieldUpdate}
              dayId={String(day.id)} embedded mode="metadata" />
          </div>
        </details>

        <details
          className={styles.details}
          open={sourceOpen}
          onToggle={(event) => setSourceOpen(event.currentTarget.open)}
        >
          <summary>Source and recording setup</summary>
          <div className={styles.detailsBody}>
            <DayProvenanceLine
              animal={animal}
              day={day}
              onChangeSource={animalDays.length > 1 ? onChangeSource : undefined}
              onChangeSetup={onChangeSetup}
            />
          </div>
        </details>
      </div>
    </Modal>
  );
}
