import { useId } from 'react';
import Button from '../../components/ui/Button';
import type { Camera, Task } from '../../state/workspaceTypes';
import './AssociatedVideosEditor.scss';

/** Editor row shape: scalars carry an empty-string sentinel for "unselected". */
interface VideoRow {
  name?: string;
  camera_id?: number | string;
  task_epochs?: number | string;
}

/**
 * Collect the day's valid task-epoch numbers (sorted, de-duplicated).
 *
 * The associated-video editor offers ONLY these as epoch options so a video can
 * never reference an epoch the day's tasks do not define — the controlled-ref
 * contract that keeps the export from carrying a dangling `task_epochs`.
 */
function collectValidEpochs(tasks: unknown): number[] {
  const seen = new Set<number>();
  (Array.isArray(tasks) ? tasks : []).forEach((task) => {
    // A malformed task_epochs inside an otherwise-valid task (a string, not an
    // array) must contribute no epochs rather than crash this repair UI on `.forEach`.
    const epochs: unknown[] = Array.isArray(task?.task_epochs) ? task.task_epochs : [];
    epochs.forEach((epoch) => {
      const n = Number(epoch);
      if (Number.isInteger(n)) seen.add(n);
    });
  });
  return [...seen].sort((a, b) => a - b);
}

interface AssociatedVideosEditorProps {
  /** The day's associated_video_files. */
  videos?: VideoRow[];
  /** The animal's cameras (camera_id options). */
  cameras?: Camera[];
  /** The day's tasks (task_epochs options). */
  tasks?: Task[];
  /** Called with the next videos array. */
  onChange: (videos: VideoRow[]) => void;
}

/**
 * AssociatedVideosEditor - workspace editor for a day's `associated_video_files`.
 *
 * Owned by the Day Editor and persisted through `onChange(nextArray)` (the step
 * routes that to `onFieldUpdate('associated_video_files', nextArray)`).
 *
 * Controlled-reference contract: each row's `camera_id` is a
 * SCALAR chosen from the animal's cameras (a `<select>`), and `task_epochs` is a
 * SCALAR chosen from the day's task epochs (a `<select>`). There is no manual
 * numeric entry for either — the normal path can only ever produce ids that exist.
 * A row loaded with a stale id (camera/epoch no longer present) is flagged and
 * cannot be left valid: the select renders no matching option, so the user must
 * re-point it before the day is clean.
 */
export default function AssociatedVideosEditor({ videos = [], cameras = [], tasks = [], onChange }: AssociatedVideosEditorProps) {
  const baseId = useId();
  // Tolerate corrupt persisted state: a non-array `videos` (e.g. `{}`) must not crash
  // `.map`/`.filter`/`.length`. It is surfaced + reset by the step's raw-shape notice;
  // here we render it as empty rather than throw.
  const videoList = Array.isArray(videos) ? videos : [];
  const validCameraIds = new Set((Array.isArray(cameras) ? cameras : []).map((c) => Number(c.id)));
  const validEpochs = collectValidEpochs(tasks);
  const validEpochSet = new Set(validEpochs);

  /**
   * Replace one row's field and emit the updated array.
   */
  function updateRow(index: number, field: keyof VideoRow, value: string | number) {
    onChange(videoList.map((video, i) => (i === index ? { ...video, [field]: value } as VideoRow : video)));
  }

  /**
   * Append an empty video row.
   */
  function addRow() {
    onChange([...videoList, { name: '', camera_id: '', task_epochs: '' }]);
  }

  /**
   * Remove the row at `index`.
   */
  function removeRow(index: number) {
    onChange(videoList.filter((_, i) => i !== index));
  }

  return (
    <section className="associated-videos-editor" aria-labelledby={`${baseId}-heading`}>
      <header className="associated-videos-header">
        <h3 id={`${baseId}-heading`}>Associated video files</h3>
        <p className="associated-videos-hint">
          Link recorded videos to a camera and a task epoch. Camera and epoch are
          chosen from this animal&apos;s cameras and this day&apos;s task epochs, so a
          video can never point at one that does not exist.
        </p>
      </header>

      {videoList.length === 0 ? (
        <p className="associated-videos-empty">No associated video files yet.</p>
      ) : (
        <ul className="associated-videos-rows">
          {videoList.map((video, index) => {
            const cameraId = video.camera_id;
            const epoch = video.task_epochs;
            const cameraStale =
              cameraId !== '' && cameraId != null && !validCameraIds.has(Number(cameraId));
            const epochStale =
              epoch !== '' && epoch != null && !validEpochSet.has(Number(epoch));
            const staleId = `${baseId}-stale-${index}`;
            const label = video.name || `video ${index + 1}`;
            return (
              <li key={index} className="associated-video-row">
                <div className="form-group">
                  <label htmlFor={`${baseId}-name-${index}`}>Video name (required)</label>
                  <input
                    id={`${baseId}-name-${index}`}
                    type="text"
                    value={video.name || ''}
                    placeholder="e.g., 20210606_J16_01_s1.1.h264"
                    required
                    aria-required="true"
                    onChange={(e) => updateRow(index, 'name', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-camera-${index}`}>Camera</label>
                  <select
                    id={`${baseId}-camera-${index}`}
                    /* Repair-focus anchor: matches the path the camera-id rule emits so a
                       repair click lands on THIS row instead of the broad step. */
                    data-field-path={`associated_video_files[${index}].camera_id`}
                    value={cameraId === '' || cameraId == null ? '' : String(cameraId)}
                    aria-invalid={cameraStale}
                    aria-describedby={cameraStale ? staleId : undefined}
                    onChange={(e) =>
                      updateRow(index, 'camera_id', e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">— select camera —</option>
                    {/* Surface a stale (removed) camera as a visible, unselectable option
                        so the user sees the value they entered instead of a blank select. */}
                    {cameraStale && (
                      <option value={String(cameraId)} disabled>
                        Missing camera — previously id {String(cameraId)}
                      </option>
                    )}
                    {(cameras || []).map((camera) => (
                      <option key={Number(camera.id)} value={String(Number(camera.id))}>
                        {Number(camera.id)} – {camera.camera_name || 'unnamed'}
                      </option>
                    ))}
                  </select>
                  {(cameras || []).length === 0 && (
                    <p className="inline-info" role="status">
                      No cameras are defined for this animal — add cameras in the Animal
                      Editor to link this video to one.
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor={`${baseId}-epoch-${index}`}>Task epoch</label>
                  <select
                    id={`${baseId}-epoch-${index}`}
                    /* Repair-focus anchor: matches the path the task-epochs rule emits. */
                    data-field-path={`associated_video_files[${index}].task_epochs`}
                    value={epoch === '' || epoch == null ? '' : String(epoch)}
                    aria-invalid={epochStale}
                    aria-describedby={epochStale ? staleId : undefined}
                    onChange={(e) =>
                      updateRow(index, 'task_epochs', e.target.value === '' ? '' : Number(e.target.value))
                    }
                  >
                    <option value="">— select epoch —</option>
                    {/* Surface a stale (orphaned) epoch as a visible, unselectable option. */}
                    {epochStale && (
                      <option value={String(epoch)} disabled>
                        Missing epoch {String(epoch)}
                      </option>
                    )}
                    {validEpochs.map((value) => (
                      <option key={value} value={String(value)}>
                        {value}
                      </option>
                    ))}
                  </select>
                  {validEpochs.length === 0 && (
                    <p className="inline-info" role="status">
                      No task epochs defined — add tasks with epochs first, then link this
                      video to one.
                    </p>
                  )}
                </div>

                <Button
                  variant="dangerSubtle"
                  size="small"
                  onClick={() => removeRow(index)}
                  aria-label={`Remove video ${label}`}
                >
                  Remove
                </Button>

                {(cameraStale || epochStale) && (
                  <div id={staleId} className="inline-error" role="alert">
                    Video &quot;{label}&quot; references{' '}
                    {cameraStale && (
                      <>
                        camera id {String(cameraId)}, which is no longer defined for this
                        animal
                      </>
                    )}
                    {cameraStale && epochStale ? ', and ' : ''}
                    {epochStale && (
                      <>
                        epoch {String(epoch)}, which is no longer defined in any task on
                        this day
                      </>
                    )}
                    . Re-point it to a current camera/epoch before exporting.
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className="button-secondary add-video-button"
        onClick={addRow}
      >
        + Add video
      </button>
    </section>
  );
}

