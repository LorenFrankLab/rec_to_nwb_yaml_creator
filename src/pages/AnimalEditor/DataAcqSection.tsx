import { useState, useId } from 'react';
import { findIdentityDivergence, DATA_ACQ_DEPENDENT_FIELDS, IDENTITY_FIELD_LABELS } from './identitySafety';
import type { IdentityDivergence, IdentityRegistryEntry } from './identitySafety';
import { getDataAcqDevices } from '../../state/workspaceSelectors';
import type { Animal, TechnicalDefaults } from '../../state/workspaceTypes';
import Modal from '../../components/Modal/Modal';
import Button from '../../components/ui/Button';
import './DataAcqSection.scss';

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
export default function DataAcqSection({ animal, onFieldUpdate, dataAcqRegistry = [] }: DataAcqSectionProps) {
  const catalog = getDataAcqDevices(animal);
  const defaults: Partial<TechnicalDefaults> = animal.technicalDefaults || {};
  const titleId = useId();

  // The open add/edit modal (null when closed). `index` is the edited catalog position.
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [error, setError] = useState('');
  const [divergence, setDivergence] = useState<IdentityDivergence | null>(null);

  // Technical defaults: local state committed on blur (independent of the device editor).
  const [tech, setTech] = useState<TechState>({
    raw_data_to_volts: defaults.raw_data_to_volts ?? 0.195,
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
    // Schema requires at least one device — never delete the last.
    if (catalog.length <= 1) return;
    onFieldUpdate('data_acq_device', catalog.filter((_, i) => i !== index));
  };

  const isValidPositive = (value: number) => value > 0;

  const technicalDefaults = (
    <details className="advanced-settings">
      <summary>Advanced Settings</summary>
      <div className="advanced-content">
        <p className="help-text">
          These seed the technical defaults for new recording days and can be overridden per day.
          Typical values are 0.195 (raw data to volts) and 1.5 (times period multiplier); change them
          only if instructed by your recording-system vendor or pipeline maintainer — incorrect values
          can corrupt data.
        </p>

        <div className="form-group">
          <label htmlFor="raw_data_to_volts">Raw Data to Volts (V/bit)</label>
          <input
            type="number"
            id="raw_data_to_volts"
            value={Number.isFinite(tech.raw_data_to_volts) ? tech.raw_data_to_volts : ''}
            onChange={(e) => setTech((p) => ({ ...p, raw_data_to_volts: parseFloat(e.target.value) }))}
            onBlur={() => commitTech(tech)}
            step="0.0001"
            min="0"
            aria-invalid={!isValidPositive(tech.raw_data_to_volts)}
            aria-describedby="raw-data-help"
          />
          <small id="raw-data-help" className="help-text">
            Conversion factor applied to each raw ADC sample to get volts (must be &gt; 0).
            Default 0.195 for SpikeGadgets/Intan rigs — do not change without pipeline-maintainer
            guidance.
          </small>
        </div>

        <div className="form-group">
          <label htmlFor="times_period_multiplier">Timestamp Scaling Factor</label>
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
            Scales the hardware clock period to derive absolute timestamps (must be &gt; 0).
            Default 1.5 for SpikeGadgets rigs — do not change without guidance.
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
          <button type="button" className="button-secondary" onClick={closeEditor}>
            Cancel
          </button>
          <button type="button" className="button-primary" onClick={saveEditor}>
            Save recording system
          </button>
        </div>
      }
    >
      <form className="data-acq-form" aria-label="Recording system editor">
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
                <tr><th>Field</th><th>Existing</th><th>This device</th></tr>
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
          <button type="button" className="button-primary add-recording-system" onClick={openAdd}>
            Add First Recording System
          </button>
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
          The recording systems this animal was recorded on. Each recording day uses one (chosen in
          the day&apos;s setup); the first here is the default a day inherits when it hasn&apos;t
          chosen its own. A single .rec session is recorded by one acquisition system — an animal
          recorded on different rigs over time is captured by different days, each using one of these.
        </p>
      </header>

      <div className="table-actions">
        <button type="button" className="button-primary add-recording-system" onClick={openAdd}>
          + Add Recording System
        </button>
      </div>

      <table className="data-acq-table cameras-table" role="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>System</th>
            <th>Amplifier</th>
            <th>ADC Circuit</th>
            <th>Role</th>
            <th>Actions</th>
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
                      disabled for the last system — the schema requires at least one. */}
                  <Button
                    variant="dangerSubtle"
                    size="small"
                    onClick={() => deleteAt(index)}
                    disabled={catalog.length <= 1}
                    title={catalog.length <= 1 ? 'The animal must have at least one recording system' : undefined}
                    aria-label={`Delete recording system ${d.name}`}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {technicalDefaults}
      {editorModal}
    </div>
  );
}

