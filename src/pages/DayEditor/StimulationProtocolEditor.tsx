import { useEffect, useRef, useState } from 'react';
import Modal from '../../components/Modal/Modal';
import Button from '../../components/ui/Button';
import { DraftNumberInput, DraftTextInput } from '../../components/ui/DraftFields';
import { FieldRequirements, RequiredMark } from '../../components/ui/FieldRequirements';
import type { BehavioralEvent, Camera, FsGuiYaml } from '../../state/workspaceTypes';
import styles from './StimulationProtocolEditor.module.css';

const PULSE_FIELDS = [
  ['pulseLength', 'Pulse length (ms)', 'any'],
  ['nPulses', 'Pulses per train', '1'],
  ['sequencePeriod', 'Sequence period (ms)', 'any'],
  ['nOutputTrains', 'Output trains', '1'],
  ['trainInterval', 'Train interval (ms)', 'any'],
] as const;

interface Props {
  draftScope?: string;
  protocol: FsGuiYaml;
  index: number;
  epochs: Array<{ epoch: number; taskName: string }>;
  cameras: Camera[];
  events: BehavioralEvent[];
  focusRequest?: { fieldPath: string; token: number } | null;
  onChange: (protocol: FsGuiYaml) => void;
  onRemove: () => void;
  onClose: () => void;
  onEditWiring: () => void;
  onEditCameras: () => void;
}

/** The same complete day-owned protocol editor serves epoch entry and validation repair. */
export default function StimulationProtocolEditor({ protocol, index, epochs, cameras, events, focusRequest,
  draftScope, onChange, onRemove, onClose, onEditWiring, onEditCameras }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const selected = Array.isArray(protocol.epochs) ? protocol.epochs : [];
  const outputs = events.filter((event) => event?.name?.trim() && !/^Din\d+$/i.test(String(event.description)));
  const path = (field: string) => `fs_gui_yamls[${index}].${field}`;
  const patch = (field: string, value: unknown) => onChange({ ...protocol, [field]: value });
  const missingEpochs = selected.filter((epoch) => !epochs.some((choice) => choice.epoch === epoch));
  const unknownCamera = protocol.camera_id !== undefined && protocol.camera_id !== '' &&
    !cameras.some((camera) => camera.id === protocol.camera_id);
  const unknownOutput = protocol.dio_output_name && !outputs.some((event) => event.name === protocol.dio_output_name);
  const advancedFocus = PULSE_FIELDS.some(([field]) => focusRequest?.fieldPath === path(field));

  useEffect(() => {
    if (!focusRequest) return;
    const frame = requestAnimationFrame(() => {
      const target = Array.from(root.current?.querySelectorAll<HTMLElement>('[data-field-path]') ?? [])
        .find((element) => element.dataset.fieldPath === focusRequest.fieldPath);
      (target ?? root.current)?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  return <Modal isOpen title="Stimulation protocol" titleId="stimulation-protocol-title" onClose={onClose}
    footer={<div className={styles.actions}><Button onClick={onClose}>Done</Button><Button variant="dangerSubtle" onClick={() => setConfirmRemove(true)}>Remove protocol</Button></div>}>
    <div ref={root} className={styles.form} tabIndex={-1}>
      <p>Changes save automatically for this recording. {selected.length > 1 && `This protocol is shared by epochs ${selected.join(', ')}; edits apply to all of them.`}</p>
      <FieldRequirements when="export" />
      {confirmRemove && <div role="alert" className={styles.confirm}>
        <p>Remove this protocol from {selected.length ? `epochs ${selected.join(', ')}` : 'this recording'}?</p>
        <Button variant="dangerSubtle" onClick={onRemove}>Confirm removal</Button>{' '}
        <Button variant="neutral" onClick={() => setConfirmRemove(false)}>Keep protocol</Button>
      </div>}
      <label><span>Protocol YAML file <RequiredMark /></span>
        <DraftTextInput value={protocol.name ?? ''} onCommit={(value) => patch('name', value)}
          draftKey={draftScope ? `${draftScope}:name` : undefined}
          data-field-path={path('name')} aria-required="true" placeholder="e.g. theta_trigger.yaml" />
      </label>
      <label><span>Power (mW) <RequiredMark /></span>
        <DraftNumberInput value={protocol.power_in_mW === '' || protocol.power_in_mW == null ? undefined : Number(protocol.power_in_mW)} onCommit={(value) => patch('power_in_mW', value)}
          draftKey={draftScope ? `${draftScope}:power_in_mW` : undefined}
          min="0" step="any" data-field-path={path('power_in_mW')} aria-required="true" />
      </label>
      <fieldset data-field-path={path('epochs')} tabIndex={-1}>
        <legend>Stimulated epochs <RequiredMark /></legend>
        <div className={styles.epochs}>
          {epochs.map(({ epoch, taskName }) => <label key={epoch}>
            <input type="checkbox" checked={selected.includes(epoch)} onChange={(event) =>
              patch('epochs', event.target.checked ? [...selected, epoch].sort((a, b) => a - b) : selected.filter((value) => value !== epoch))} />
            {epoch} · {taskName}
          </label>)}
          {missingEpochs.map((epoch) => <label key={`missing-${epoch}`}>
            <input type="checkbox" checked onChange={() => patch('epochs', selected.filter((value) => value !== epoch))} />
            Missing epoch {String(epoch)} — uncheck to remove
          </label>)}
        </div>
        {!selected.length && <p className={styles.hint}>Choose at least one epoch before export.</p>}
      </fieldset>
      <label><span>Camera for spatial filters <RequiredMark /></span>
        <select value={protocol.camera_id ?? ''} aria-required="true" data-field-path={path('camera_id')}
          onChange={(event) => patch('camera_id', event.target.value === '' ? undefined : cameras.find((camera) => String(camera.id) === event.target.value)?.id)}>
          <option value="">Choose a camera…</option>
          {unknownCamera && <option value={String(protocol.camera_id)} disabled>Missing camera {String(protocol.camera_id)}</option>}
          {cameras.map((camera) => <option key={camera.id} value={camera.id}>{camera.camera_name || `Camera ${camera.id}`}</option>)}
        </select>
      </label>
      {!cameras.length && <Button variant="neutral" onClick={onEditCameras}>Set up a camera</Button>}
      <label><span>DIO output <RequiredMark /></span>
        <select value={protocol.dio_output_name ?? ''} aria-required="true" data-field-path={path('dio_output_name')}
          onChange={(event) => patch('dio_output_name', event.target.value)}>
          <option value="">Choose a named output…</option>
          {unknownOutput && <option value={protocol.dio_output_name} disabled>Missing output: {protocol.dio_output_name}</option>}
          {outputs.map((event) => <option key={event.name} value={event.name}>{event.name} · {event.description}</option>)}
        </select>
      </label>
      <Button variant="neutral" size="small" onClick={onEditWiring}>Set up DIO outputs</Button>
      <details open={advancedFocus || undefined}>
        <summary>Pulse and train settings (optional)</summary>
        <p className={styles.hint}>Enter these when the stimulation parameters are not supplied by the FsGUI protocol.</p>
        <div className={styles.form}>{PULSE_FIELDS.map(([field, label, step]) => <label key={field}>{label}
          <DraftNumberInput value={protocol[field] === '' || protocol[field] == null ? undefined : Number(protocol[field])} min="0" step={step}
            draftKey={draftScope ? `${draftScope}:${field}` : undefined}
            data-field-path={path(field)} onCommit={(value) => patch(field, value)} />
        </label>)}</div>
      </details>
    </div>
  </Modal>;
}
