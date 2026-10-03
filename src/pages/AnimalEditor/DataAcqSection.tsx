import OverflowMenu from '../../components/OverflowMenu';
import { FieldRequirements } from '../../components/ui/FieldRequirements';
import { recordingSystemReviewed, recordingSystemSignature } from '../../domain/animalSetupProgress';
import { RIG_FALLBACK } from '../../domain/rigConstants';
import { useState, useId } from 'react';
import { findIdentityDivergence, DATA_ACQ_DEPENDENT_FIELDS, IDENTITY_FIELD_LABELS } from './identitySafety';
import type { IdentityDivergence, IdentityRegistryEntry } from './identitySafety';
import { getDataAcqDevices, getDayDataAcqDeviceName } from '../../state/workspaceSelectors';
import type { Animal, DataAcqDevice, Day, TechnicalDefaults } from '../../state/workspaceTypes';
import Modal from '../../components/Modal/Modal';
import Button from '../../components/ui/Button';
import './DataAcqSection.scss';
import '../../components/ui/SetupTable.css';
/** The four string fields that define a recording-system catalog entry. */
interface DeviceFields {
  name: string;
  system: string;
  amplifier: string;
  adc_circuit: string;
}

const DEVICE_FIELDS: Array<keyof DeviceFields> = ['name', 'system', 'amplifier', 'adc_circuit'];

/** Normalize a device's four string fields (trimmed). */
function normalizeDeviceFields(fields: Partial<DeviceFields>): DeviceFields {
  return {
    name: String(fields.name ?? '').trim(),
    system: String(fields.system ?? '').trim(),
    amplifier: String(fields.amplifier ?? '').trim(),
    adc_circuit: String(fields.adc_circuit ?? '').trim(),
  };
}

/** Whether all four device fields are present. */
function isCompleteDevice(device: DeviceFields): boolean {
  return DEVICE_FIELDS.every((field) => device[field]);
}

/** The identity-dependent fields of a device (everything but the name). */
function dependentFields(device: DeviceFields): Record<string, string> {
  return Object.fromEntries(
    DATA_ACQ_DEPENDENT_FIELDS.map((field): [string, string] => [field, device[field as keyof DeviceFields]])
  );
}

const BLANK_DEVICE: DeviceFields = { name: '', system: 'SpikeGadgets', amplifier: '', adc_circuit: '' };

/**
 * How many of `days` export each catalog entry: the one a day names, or the first (the default) for
 * a day that names none — the export's own resolution (`resolveDayDataAcqDevice`).
 *
 * @param catalog - The animal's recording systems.
 * @param days - The animal's recording days.
 * @returns One count per catalog entry.
 */
function daysUsingEach(catalog: DataAcqDevice[], days: Day[]): number[] {
  const counts = catalog.map(() => 0);
  for (const day of days) {
    const name = getDayDataAcqDeviceName(day) || '';
    const index = name ? catalog.findIndex((device) => device?.name === name) : 0;
    if (index >= 0 && index < counts.length) counts[index] += 1;
  }
  return counts;
}

/**
 * The note on a system's Delete action saying how many recording days use it.
 *
 * @param count - The days that export the system.
 * @returns The note, or undefined when no day uses it.
 */
function usedByNote(count: number): string | undefined {
  if (count === 0) return undefined;
  const days = count === 1 ? '1 recording day' : `${count} recording days`;
  return `Used by ${days}: deleting it would change what ${count === 1 ? 'it exports' : 'they export'}.`;
}

/**
 * The note on "Make default" saying which days stay on the current default.
 *
 * @param count - The days that name no system (they export the default).
 * @param defaultName - The current default's name.
 * @returns The note: new days use the chosen system, those days keep the current one.
 */
function keepsDefaultNote(count: number, defaultName: string): string {
  if (count === 0) return 'New recording days will use it.';
  const days = count === 1 ? '1 recording day keeps' : `${count} recording days keep`;
  return `New recording days will use it; ${days} ${defaultName}.`;
}

/** The open add/edit modal state (null when closed). `index` is the edited catalog position. */
interface EditingState {
  mode: 'add' | 'edit';
  index: number | null;
  fields: DeviceFields;
}

/** Local state for the technical-defaults editor (committed on blur). */
interface TechState {
  raw_data_to_volts: number;
  times_period_multiplier: number;
}

interface DataAcqSectionProps {
  /** Animal record (`devices.data_acq_device`, `technicalDefaults`). */
  animal: Animal;
  /** Field update callback (field, value). */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** Data-acq identities elsewhere in the dataset, for divergent-reuse detection. */
  dataAcqRegistry?: IdentityRegistryEntry[];
  /** This animal's recording days, so a system they use is not deleted from under them. */
  days?: Day[];
  /**
   * Make the named system the default. The host first sets the days on "Default" to name the
   * current default, so their exports do not change. Absent ⇒ the action is not offered.
   */
  onMakeDefault?: (name: string) => void;
}

/**
 * DataAcqSection — the animal's Recording System CATALOG + technical defaults (Animal View tab).
 *
 * Mirrors the Cameras tab: a table of acquisition systems with `+ Add` / Edit / Delete and a modal
 * editor. The animal owns a LIST (`devices.data_acq_device`); each recording day references the ONE
 * it used (Day Editor); the first catalog entry is the default unreferenced days inherit. `name` is
 * the Spyglass `DataAcquisitionDevice` identity — unique within the catalog, and a same-name-
 * different-hardware reuse elsewhere in the dataset is blocked with a side-by-side comparison.
 *
 * The technical DEFAULTS (`raw_data_to_volts`, `times_period_multiplier`) are animal-level
 * (`animal.technicalDefaults`, seeded into each day's `technical`); never exported directly.
 */
export default function DataAcqSection({ animal, onFieldUpdate, dataAcqRegistry = [], days = [], onMakeDefault }: DataAcqSectionProps) {
  const catalog = getDataAcqDevices(animal);
  const dayCounts = daysUsingEach(catalog, days);
  // Days that name no system export the default; making another one the default keeps them on it.
  const daysOnDefault = days.filter((day) => !getDayDataAcqDeviceName(day)).length;
  const defaultName = normalizeDeviceFields(catalog[0] ?? {}).name;
  const defaults: Partial<TechnicalDefaults> = animal.technicalDefaults || {};
  const titleId = useId();

  // The open add/edit modal (null when closed). `index` is the edited catalog position.
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [error, setError] = useState('');
  const [divergence, setDivergence] = useState<IdentityDivergence | null>(null);

  // Technical defaults: local state committed on blur (independent of the device editor).
  const [tech, setTech] = useState<TechState>({
    raw_data_to_volts: defaults.raw_data_to_volts ?? RIG_FALLBACK.raw_data_to_volts,
    times_period_multiplier: defaults.times_period_multiplier ?? 1.5,
  });
  const commitTech = (next: TechState) =>
    onFieldUpdate('technicalDefaults', {
      raw_data_to_volts: next.raw_data_to_volts,
      times_period_multiplier: next.times_period_multiplier,
    });

  const openAdd = () => {
    setError('');
    setDivergence(null);
    setEditing({ mode: 'add', index: null, fields: { ...BLANK_DEVICE } });
  };
  const openEdit = (index: number) => {
    setError('');
    setDivergence(null);
    setEditing({ mode: 'edit', index, fields: { ...normalizeDeviceFields(catalog[index]) } });
  };
  const closeEditor = () => {
    setEditing(null);
    setError('');
    setDivergence(null);
  };
  const setEditorField = (field: string, value: string) =>
    setEditing((prev) => ({ ...prev!, fields: { ...prev!.fields, [field]: value } as DeviceFields }));

  const saveEditor = () => {
    const candidate = normalizeDeviceFields(editing!.fields);
    if (!isCompleteDevice(candidate)) {
      setDivergence(null);
      setError('Complete name, system, amplifier, and ADC circuit before saving.');
      return;
    }
    // Name-uniqueness within the catalog (the name IS the Spyglass identity) — excluding the edited row.
    const clashesInCatalog = catalog.some(
      (d, i) => i !== editing!.index && normalizeDeviceFields(d).name === candidate.name
    );
    if (clashesInCatalog) {
      setDivergence(null);
      setError('That name is already in the catalog. Each recording system must have a unique name.');
      return;
    }
    // Cross-dataset divergence: the same name used on another animal with DIFFERENT hardware.
    const conflict = findIdentityDivergence(candidate.name, dependentFields(candidate), dataAcqRegistry);
    if (conflict) {
      setError('');
      setDivergence(conflict);
      return;
    }
    const next =
      editing!.mode === 'add'
        ? [...catalog, candidate]
        : catalog.map((d, i) => (i === editing!.index ? candidate : d));
    onFieldUpdate('data_acq_device', next);
    closeEditor();
  };

  const deleteAt = (index: number) => {
    // Schema requires at least one device — never delete the last. Nor one that recording days use
    // (W12): they export it by name, or as the default when it is first, and deleting it would
    // silently move them to another system's hardware.
    if (catalog.length <= 1 || dayCounts[index] > 0) return;
    onFieldUpdate('data_acq_device', catalog.filter((_, i) => i !== index));
  };

  const isValidPositive = (value: number) => value > 0;

  const technicalDefaults = (
    <details className="advanced-settings">
      <summary>Advanced Settings</summary>
      <div className="advanced-content">
        <p className="help-text">
          These seed the technical defaults for new recording days and can be overridden per day.
          The voltage default is 1.95e-7 V/count (0.195 µV/count); the legacy period multiplier is 1.5. Change them
          only if instructed by your recording-system vendor or pipeline maintainer — incorrect values
          can corrupt data.
        </p>

        <div className="form-group">
          <label htmlFor="raw_data_to_volts">Voltage conversion (V/count)</label>
          <input
            type="number"
            id="raw_data_to_volts"
            value={Number.isFinite(tech.raw_data_to_volts) ? tech.raw_data_to_volts : ''}
            onChange={(e) => setTech((p) => ({ ...p, raw_data_to_volts: parseFloat(e.target.value) }))}
            onBlur={() => commitTech(tech)}
            step="any"
            min="0"
            aria-invalid={!isValidPositive(tech.raw_data_to_volts)}
            aria-describedby="raw-data-help"
          />
          <small id="raw-data-help" className="help-text">
            Conversion factor applied to each raw ADC sample to get volts (must be &gt; 0).
            Default 1.95e-7 V/count = 0.195 µV/count for SpikeGadgets/Intan. Verify against acquisition
            guidance.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="times_period_multiplier">Legacy times period multiplier</label>
          <input
            type="number"
            id="times_period_multiplier"
            value={Number.isFinite(tech.times_period_multiplier) ? tech.times_period_multiplier : ''}
            onChange={(e) => setTech((p) => ({ ...p, times_period_multiplier: parseFloat(e.target.value) }))}
            onBlur={() => commitTech(tech)}
            step="0.0001"
            min="0"
            aria-invalid={!isValidPositive(tech.times_period_multiplier)}
            aria-describedby="times-help"
          />
          <small id="times-help" className="help-text">
            Retained for older metadata. The current converter derives timestamps from the
            recording; this field does not rescale them. Default 1.5.
          </small>
        </div>
      </div>
    </details>
  );

  // Shared add/edit modal (mirrors CameraModal). isOpen is driven by `editing`.
  const editorModal = (
    <Modal
      isOpen={editing != null}
      onClose={closeEditor}
      title={editing?.mode === 'add' ? 'Add Recording System' : 'Edit Recording System'}
      titleId={titleId}
      className="recording-system-modal"
      footer={
        <div className="recording-system-editor-actions">
          <Button variant="secondary" onClick={closeEditor}>
            Cancel
          </Button>
          <Button onClick={saveEditor}>
            Save recording system
          </Button>
        </div>
      }
    >
      <form className="data-acq-form" aria-label="Recording system editor">
        <FieldRequirements />
        <div className="form-group">
          <label htmlFor="data_acq_name">
            Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="data_acq_name"
            value={editing?.fields.name ?? ''}
            onChange={(e) => setEditorField('name', e.target.value)}
            placeholder="e.g., SpikeGadgets_MCU"
            required
          />
          <small className="help-text">
            Identifies this acquisition device. The same name must mean the same hardware.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="system">
            System <span className="required">*</span>
          </label>
          <select
            id="system"
            value={editing?.fields.system ?? 'SpikeGadgets'}
            onChange={(e) => setEditorField('system', e.target.value)}
            required
          >
            <option value="SpikeGadgets">SpikeGadgets</option>
            <option value="Open Ephys">Open Ephys</option>
            <option value="Intan">Intan</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="amplifier">
            Amplifier <span className="required">*</span>
          </label>
          <input
            type="text"
            id="amplifier"
            value={editing?.fields.amplifier ?? ''}
            onChange={(e) => setEditorField('amplifier', e.target.value)}
            placeholder="e.g., Intan RHD2000"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="adc_circuit">
            ADC Circuit <span className="required">*</span>
          </label>
          <input
            type="text"
            id="adc_circuit"
            value={editing?.fields.adc_circuit ?? ''}
            onChange={(e) => setEditorField('adc_circuit', e.target.value)}
            placeholder="e.g., Intan"
            required
          />
        </div>

        {error && (
          <div className="validation-error" role="alert">
            {error}
          </div>
        )}

        {divergence && (
          <div className="identity-divergence" role="alert">
            <p className="identity-divergence-title">
              The name “{(editing?.fields.name ?? '').trim()}” is already used by{' '}
              {divergence.existing.label} with different hardware. The same data-acq name must mean the
              same device.
            </p>
            <table className="identity-divergence-table">
              <thead>
                <tr><th scope="col">Field</th><th scope="col">Existing</th><th scope="col">This device</th></tr>
              </thead>
              <tbody>
                {divergence.differingFields.map((field) => (
                  <tr key={field}>
                    <td>{IDENTITY_FIELD_LABELS[field] || field}</td>
                    <td>{String(divergence.existing.fields[field] ?? '')}</td>
                    <td>{String(editing?.fields[field as keyof DeviceFields] ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </form>
    </Modal>
  );

  // Empty state (mirrors CamerasSection).
  if (catalog.length === 0) {
    return (
      <div className="data-acq-section">
        <div className="cameras-section empty-state">
          <div className="empty-state-icon">🎛️</div>
          <h3>No Recording System Configured</h3>
          <p>
            The recording systems this animal was recorded on. Each recording day uses one; the first
            is the default a day inherits when it hasn&apos;t chosen its own.
          </p>
          <Button variant="secondary" className="add-recording-system" onClick={openAdd}>
            Add First Recording System
          </Button>
        </div>
        {technicalDefaults}
        {editorModal}
      </div>
    );
  }

  return (
    <div className="data-acq-section">
      <header className="section-header">
        <h2>Recording System</h2>
        <p>
          Add the systems used for this animal. New recordings start with the default system; change it in a recording’s setup when needed.
        </p>
      </header>

      <div className="table-actions">
        <Button variant="secondary" className="add-recording-system" onClick={openAdd}>
          + Add Recording System
        </Button>
      </div>

      <div className="setup-table-scroll">
      <table className="setup-table" role="table">
        <thead>
          <tr>
            <th scope="col">Name</th>
            <th scope="col">System</th>
            <th scope="col">Amplifier</th>
            <th scope="col">ADC Circuit</th>
            <th scope="col">Role</th>
            <th scope="col">Actions</th>
          </tr>
        </thead>
        <tbody>
          {catalog.map((device, index) => {
            const d = normalizeDeviceFields(device);
            return (
              <tr key={`${d.name}-${index}`}>
                <td data-label="Name">{d.name || '(unnamed)'}</td>
                <td data-label="System">{d.system}</td>
                <td data-label="Amplifier">{d.amplifier}</td>
                <td data-label="ADC Circuit">{d.adc_circuit}</td>
                <td data-label="Role">
                  {index === 0 && <span className="recording-system-default-badge">Default</span>}
                </td>
                <td data-label="Actions">
                  <Button
                    variant="neutral"
                    size="small"
                    onClick={() => openEdit(index)}
                    aria-label={`Edit recording system ${d.name}`}
                  >
                    Edit
                  </Button>
                  {/* Always present (consistent with the Electrode Groups / Cameras tabs), but
                      disabled for the last system — the schema requires at least one — and for a
                      system recording days use, saying how many. */}
                  <OverflowMenu
                    label={`Actions for recording system ${d.name}`}
                    items={[
                      ...(onMakeDefault && index > 0 && defaultName !== ''
                        ? [{
                            key: 'make-default',
                            label: `Make ${d.name} the default`,
                            onSelect: () => onMakeDefault(d.name),
                            description: keepsDefaultNote(daysOnDefault, defaultName),
                          }]
                        : []),
                      { key: 'delete', label: `Delete recording system ${d.name}`, onSelect: () => deleteAt(index), disabled: catalog.length <= 1 || dayCounts[index] > 0, description: usedByNote(dayCounts[index]), },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="recording-system-review">
        {recordingSystemReviewed(animal) ? <p>Recording system reviewed.</p> : <>
          <p>Check that this default matches the recording hardware.</p>
          <Button variant="primary" onClick={() => onFieldUpdate('recordingSystemReviewed', recordingSystemSignature(animal))}>Confirm recording system</Button>
        </>}
      </div>

      {technicalDefaults}
      {editorModal}
    </div>
  );
}
