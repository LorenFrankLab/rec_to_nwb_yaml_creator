import AssociatedFilesEditor from './AssociatedFilesEditor';
import { getAnimalSubject, getDayAssociatedFiles, getDaySession } from '../../state/workspaceSelectors';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { Task } from '../../state/workspaceTypes';
import type { FieldValueViewModel } from '../../viewModels/types';

interface DayFilesWeightSectionProps extends DayEditorBundle {
  /**
   * The day-editor view-model's Overview field slice. Weight still derives from the existing
   * Overview validation/gate substrate, but Phase 15 presents it in Files & Weight.
   */
  overviewFields?: FieldValueViewModel[];
}

/**
 * Files & Weight — day-owned file context plus the recording-day weight.
 *
 * This section owns only day-delta facts: the off-export data folder, exported recording-day
 * weight (`session.weight`), and exported `associated_files`. Animal baseline weight is named only
 * as a fallback; editing here never mutates the animal profile.
 */
export default function DayFilesWeightSection(props: DayFilesWeightSectionProps) {
  const { animal, day, mergedDay, onFieldUpdate } = useDayEditorContext(props);
  const session = getDaySession(day);
  const subject = getAnimalSubject(animal);
  const fieldsByPath = new Map((props.overviewFields ?? []).map((field) => [field.fieldPath, field]));
  const overviewField = (path: string) => fieldsByPath.get(path);
  const tasks = Array.isArray(mergedDay?.tasks) ? (mergedDay.tasks as Task[]) : [];

  return (
    <div className="files-weight-step">
      <section className="day-editor-section">
        <h2>Files &amp; Weight</h2>

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
        </div>

        <AssociatedFilesEditor
          files={getDayAssociatedFiles(day)}
          tasks={tasks}
          onChange={(files) => onFieldUpdate('associated_files', files)}
        />
      </section>
    </div>
  );
}
