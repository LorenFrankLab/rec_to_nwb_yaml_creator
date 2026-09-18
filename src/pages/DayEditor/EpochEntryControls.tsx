import { useRef, useState } from 'react';
import Button from '../../components/ui/Button';
import type { TaskType } from '../../state/workspaceTypes';
import styles from './EpochsTab.module.css';

export type VideoAnswer = 'yes' | 'no' | 'later';

/** Native radios keep the three answers visible and support keyboard arrow navigation. */
export function EpochVideoChoice({ epoch, value, disabled, onChange }: {
  epoch: number;
  value: VideoAnswer | '';
  disabled?: boolean;
  onChange: (value: VideoAnswer) => void;
}) {
  return <fieldset className={styles.videoChoice} disabled={disabled} aria-describedby={`epoch-video-help-${epoch}`}>
    <legend className="sr-only">Was video recorded for epoch {epoch}?</legend>
    {(['yes', 'no', 'later'] as const).map((answer) => <label key={answer}>
      <input type="radio" name={`epoch-${epoch}-video-answer`} value={answer}
        checked={value === answer} onChange={() => onChange(answer)} />
      <span>{answer === 'yes' ? 'Yes' : answer === 'no' ? 'No' : 'Enter later'}</span>
    </label>)}
  </fieldset>;
}

/** Adding always requires an explicit task choice, even when only one task is saved. */
export function EpochComposer({ nextEpoch, empty, types, disabled, onAdd, onCreateTask }: {
  nextEpoch: number;
  empty: boolean;
  types: TaskType[];
  disabled: boolean;
  onAdd: (taskId: string) => void;
  onCreateTask: () => void;
}) {
  const [taskId, setTaskId] = useState('');
  const selectRef = useRef<HTMLSelectElement>(null);
  const selected = types.find((task) => task.id === taskId);
  return <form className={styles.composer} aria-labelledby="epoch-composer-title" onSubmit={(event) => {
    event.preventDefault();
    if (!selected || disabled) return;
    onAdd(selected.id);
    setTaskId('');
    selectRef.current?.focus();
  }}>
    <div className={styles.composerHeading}>
      <span className={styles.epochNumber} aria-hidden="true">{String(nextEpoch).padStart(2, '0')}</span>
      <div>
        <h3 id="epoch-composer-title">{empty ? 'What happened first?' : 'Add the next epoch'}</h3>
        {empty && <p>Choose the first task in this recording, then build the sequence in order.</p>}
      </div>
    </div>
    {types.length > 0 ? <div className={styles.composerFields}>
      <div className={styles.composerTask}><label htmlFor="next-epoch-task">Task for epoch {nextEpoch}</label>
        <select ref={selectRef} id="next-epoch-task" value={selected?.id ?? ''} disabled={disabled}
          onChange={(event) => setTaskId(event.target.value)}>
          <option value="">Choose a task…</option>
          {types.map((task) => <option key={task.id} value={task.id}>{task.task_name || task.id}</option>)}
        </select>
      </div>
      <Button type="submit" disabled={!selected || disabled}>Add epoch {nextEpoch}</Button>
      <button type="button" className={styles.textAction} disabled={disabled} onClick={onCreateTask}>Create a new task</button>
    </div> : <div className={styles.composerFields}>
      <p>Add the task’s name, description and usual room once. You can reuse it for later epochs and days.</p>
      <Button id="create-first-epoch" disabled={disabled} onClick={onCreateTask}>Create first task and epoch</Button>
    </div>}
  </form>;
}
