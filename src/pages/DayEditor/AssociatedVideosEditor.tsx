import { useId } from 'react';
import Button from '../../components/ui/Button';
import type { AssociatedVideoFile, Camera, Task } from '../../state/workspaceTypes';
import { collectValidEpochs } from './AssociatedFilesEditor';
import './AssociatedFilesEditor.scss';

interface Props {
  videos: AssociatedVideoFile[];
  cameras: Camera[];
  tasks: Task[];
  onChange: (videos: AssociatedVideoFile[]) => void;
}

/** Every retained video stays editable, including videos whose epoch was deleted. */
export default function AssociatedVideosEditor({ videos, cameras, tasks, onChange }: Props) {
  const baseId = useId();
  const epochs = collectValidEpochs(tasks);
  const update = (index: number, patch: Partial<AssociatedVideoFile>) =>
    onChange(videos.map((video, i) => i === index ? { ...video, ...patch } : video));

  return <section className="associated-files-editor" aria-labelledby={`${baseId}-heading`}>
    <div className="associated-files-header">
      <h3 id={`${baseId}-heading`}>Video files</h3>
      <p className="associated-files-hint">Add videos from an epoch above. Each video needs a file name, camera and recording epoch.</p>
    </div>
    {videos.length === 0 && <p className="associated-files-empty">No video files yet.</p>}
    <ul className="associated-files-rows">
      {videos.map((video, index) => {
        const prefix = `associated_video_files[${index}]`;
        const validEpoch = video.task_epochs !== '' && video.task_epochs != null && epochs.includes(Number(video.task_epochs));
        const validCamera = video.camera_id != null && cameras.some((camera) => camera.id === video.camera_id);
        const label = video.name || `video ${index + 1}`;
        return <li key={video.recordId ?? index} data-record-id={video.recordId} className="associated-file-row">
          <div className="form-group">
            <label htmlFor={`${baseId}-name-${index}`}>Video file name (required)</label>
            <input id={`${baseId}-name-${index}`} value={video.name || ''} required
              data-field-path={`${prefix}.name`} aria-invalid={!video.name?.trim()}
              onChange={(event) => update(index, { name: event.target.value })} />
          </div>
          <div className="form-group">
            <label htmlFor={`${baseId}-camera-${index}`}>Camera (required)</label>
            <select id={`${baseId}-camera-${index}`} value={video.camera_id ?? ''} required
              data-field-path={`${prefix}.camera_id`} aria-invalid={!validCamera}
              onChange={(event) => update(index, { camera_id: Number(event.target.value) })}>
              {!validCamera && <option value={video.camera_id ?? ''} disabled>{video.camera_id == null ? 'Select camera' : `Missing camera ${video.camera_id}`}</option>}
              {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.camera_name || `Camera ${camera.id}`}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor={`${baseId}-epoch-${index}`}>Video epoch (required)</label>
            <select id={`${baseId}-epoch-${index}`} value={video.task_epochs ?? ''} required
              data-field-path={`${prefix}.task_epochs`} aria-invalid={!validEpoch}
              aria-describedby={!validEpoch ? `${baseId}-epoch-error-${index}` : undefined}
              onChange={(event) => update(index, { task_epochs: event.target.value === '' ? '' : Number(event.target.value) })}>
              <option value="">— select epoch —</option>
              {!validEpoch && video.task_epochs !== '' && video.task_epochs != null && <option value={video.task_epochs} disabled>Missing epoch {video.task_epochs}</option>}
              {epochs.map((epoch) => <option key={epoch} value={epoch}>{epoch}</option>)}
            </select>
          </div>
          <Button variant="dangerSubtle" size="small" aria-label={`Remove video ${label}`}
            onClick={() => onChange(videos.filter((_, i) => i !== index))}>Remove</Button>
          {!validEpoch && <p className="inline-error" id={`${baseId}-epoch-error-${index}`}>Video “{label}” needs a recording epoch. Select an epoch or remove this video before export.</p>}
          {!validCamera && <p className="inline-error">Choose a camera for “{label}”. Add missing cameras in Recording Setup.</p>}
        </li>;
      })}
    </ul>
  </section>;
}
