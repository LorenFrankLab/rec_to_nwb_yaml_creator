import { useState } from 'react';
import { Modal } from '../../components/Modal';
import Button from '../../components/ui/Button';
import type { TaskInstance, TaskType } from '../../state/workspaceTypes';

interface Props {
  kind: 'sleep' | 'wtrack';
  types: TaskType[];
  defaults?: { sleep?: string; run?: string };
  onClose: () => void;
  onApply: (instances: TaskInstance[], defaults: { sleep: string; run?: string }) => void;
}

/** Task names identify shared definitions. A template chooses existing identities explicitly. */
export default function TaskTemplateDialog({ kind, types, defaults, onClose, onApply }: Props) {
  const initial = (saved: string | undefined, name: string) =>
    types.find((type) => type.id === saved)?.id
      ?? types.find((type) => type.task_name.toLowerCase() === name.toLowerCase())?.id ?? '';
  const [sleep, setSleep] = useState(() => initial(defaults?.sleep, 'Sleep'));
  const [run, setRun] = useState(() => initial(defaults?.run, 'W-track'));
  const sequence = kind === 'sleep' ? [sleep, sleep, sleep, sleep] : [sleep, run, sleep, run];
  const ready = sequence.every((id) => types.some((type) => type.id === id));
  const selectTask = (label: string, id: string, change: (id: string) => void) => (
    <div className="form-field">
      <label htmlFor={`template-${label.split(' ')[0]}`}>{label}</label>
      <select id={`template-${label.split(' ')[0]}`} value={id} onChange={(event) => change(event.target.value)}>
        <option value="">Choose a task type…</option>
        {types.map((type) => <option key={type.id} value={type.id}>{type.task_name}</option>)}
      </select>
    </div>
  );
  return (
    <Modal isOpen onClose={onClose} title="Choose tasks for the template" titleId="task-template-title"
      footer={<div className="form-actions">
        <Button variant="neutral" onClick={onClose}>Cancel</Button>
        <Button disabled={!ready} onClick={() => {
          const instances: TaskInstance[] = [];
          sequence.forEach((taskTypeId, index) => {
            const existing = instances.find((instance) => instance.taskTypeId === taskTypeId);
            if (existing) existing.task_epochs.push(index + 1);
            else instances.push({ taskTypeId, task_epochs: [index + 1] });
          });
          onApply(instances, { sleep, ...(kind === 'wtrack' ? { run } : {}) });
        }}>Apply template</Button>
      </div>}>
      <p>Select the task names your lab uses. These choices are saved for this animal.</p>
      <div className="form-grid">
        {selectTask('Sleep task', sleep, setSleep)}
        {kind === 'wtrack' && selectTask('Run task', run, setRun)}
      </div>
      {types.length === 0 && <p>Create the first task and epoch, then reopen this template.</p>}
      <h3>Recording sequence</h3>
      <ol>{sequence.map((id, index) => {
        const type = types.find((candidate) => candidate.id === id);
        return <li key={index}>
          {type?.task_name ?? 'Choose a task'}{type && ` — ${type.task_environment || 'environment missing'}; cameras: ${type.camera_id?.join(', ') || 'none'}`}
        </li>;
      })}</ol>
      <p>You can edit each epoch’s environment and cameras after applying the template.</p>
    </Modal>
  );
}
