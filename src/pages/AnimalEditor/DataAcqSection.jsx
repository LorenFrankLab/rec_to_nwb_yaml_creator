import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { findIdentityDivergence, DATA_ACQ_DEPENDENT_FIELDS, IDENTITY_FIELD_LABELS } from './identitySafety';
import { getDataAcqDevices } from '../../state/workspaceSelectors';
import { rawArray } from '../../components/rawPropTypes';
import './DataAcqSection.scss';

const DEVICE_FIELDS = ['name', 'system', 'amplifier', 'adc_circuit'];

/**
 * Normalize a device's four string fields (trimmed).
 * @param {object} fields - Raw device fields.
 * @returns {object} Normalized {name, system, amplifier, adc_circuit}.
 */
function normalizeDeviceFields(fields) {
  return {
    name: String(fields.name ?? '').trim(),
    system: String(fields.system ?? '').trim(),
    amplifier: String(fields.amplifier ?? '').trim(),
    adc_circuit: String(fields.adc_circuit ?? '').trim(),
  };
}

/**
 * Whether all four device fields are present.
 * @param {object} device - Normalized device.
 * @returns {boolean}
 */
function isCompleteDevice(device) {
  return DEVICE_FIELDS.every((field) => device[field]);
}

/**
 * The identity-dependent fields of a device (everything but the name).
 * @param {object} device - A device.
 * @returns {object} {system, amplifier, adc_circuit}.
 */
function dependentFields(device) {
  return Object.fromEntries(DATA_ACQ_DEPENDENT_FIELDS.map((field) => [field, device[field]]));
}

const BLANK_DEVICE = { name: '', system: 'SpikeGadgets', amplifier: '', adc_circuit: '' };

/**
 * DataAcqSection — the animal's Recording System CATALOG + technical defaults (Animal View tab).
 *
 * The animal owns a LIST of acquisition systems (`devices.data_acq_device`, like the Cameras catalog):
 * an animal recorded on different rigs over its life accumulates several here. Each recording day
 * references the ONE it used (Day Editor); the first catalog entry is the default unreferenced days
 * inherit. `name` is the Spyglass `DataAcquisitionDevice` identity — unique within the catalog, and a
 * same-name-different-hardware reuse elsewhere in the dataset is blocked with a side-by-side comparison.
 *
 * The technical DEFAULTS (`raw_data_to_volts`, `times_period_multiplier`) are animal-level
 * (`animal.technicalDefaults`, seeded into each day's `technical` at createDay, overridable per day);
 * they are never exported directly.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record (`devices.data_acq_device`, `technicalDefaults`).
 * @param {Function} props.onFieldUpdate - Field update callback (field, value).
 * @param {Array<{name: string, fields: object, label: string}>} [props.dataAcqRegistry] - Data-acq
 *   identities elsewhere in the dataset, for divergent-reuse detection.
 * @returns {JSX.Element}
 */
export default function DataAcqSection({ animal, onFieldUpdate, dataAcqRegistry = [] }) {
  // Read the catalog through the canonical selector: a corrupt non-array degrades to [].
  const catalog = getDataAcqDevices(animal);
  const defaults = animal.technicalDefaults || {};
  const nameInputRef = useRef(null);

  // The open add/edit editor (null when the list is shown). `index` is the edited catalog position.
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [divergence, setDivergence] = useState(null);

  // Technical defaults: local state committed on blur (independent of the device editor).
  const [tech, setTech] = useState({
    raw_data_to_volts: defaults.raw_data_to_volts ?? 0.195,
    times_period_multiplier: defaults.times_period_multiplier ?? 1.5,
  });
  const commitTech = (next) =>
    onFieldUpdate('technicalDefaults', {
      raw_data_to_volts: next.raw_data_to_volts,
      times_period_multiplier: next.times_period_multiplier,
    });

  const openAdd = () => {
    setError('');
    setDivergence(null);
    setEditing({ mode: 'add', index: null, fields: { ...BLANK_DEVICE } });
  };
  const openEdit = (index) => {
    setError('');
    setDivergence(null);
    setEditing({ mode: 'edit', index, fields: { ...normalizeDeviceFields(catalog[index]) } });
  };
  const cancelEdit = () => {
    setEditing(null);
    setError('');
    setDivergence(null);
  };
  const setEditorField = (field, value) =>
    setEditing((prev) => ({ ...prev, fields: { ...prev.fields, [field]: value } }));

  const saveEditor = () => {
    const candidate = normalizeDeviceFields(editing.fields);
    if (!isCompleteDevice(candidate)) {
      setDivergence(null);
      setError('Complete name, system, amplifier, and ADC circuit before saving.');
      return;
    }
    // Name-uniqueness within the catalog (the name IS the Spyglass identity) — excluding the row being
    // edited. Two systems can't share a name.
    const clashesInCatalog = catalog.some(
      (d, i) => i !== editing.index && normalizeDeviceFields(d).name === candidate.name
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
      editing.mode === 'add'
        ? [...catalog, candidate]
        : catalog.map((d, i) => (i === editing.index ? candidate : d));
    onFieldUpdate('data_acq_device', next);
    cancelEdit();
  };

  const deleteAt = (index) => {
    // Schema requires at least one device — never delete the last.
    if (catalog.length <= 1) return;
    onFieldUpdate('data_acq_device', catalog.filter((_, i) => i !== index));
  };

  const isValidPositive = (value) => value > 0;

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

      {/* The catalog list */}
      <ul className="recording-system-list">
        {catalog.length === 0 && (
          <li className="recording-system-empty">No recording system yet — add the one this animal was recorded on.</li>
        )}
        {catalog.map((device, index) => {
          const d = normalizeDeviceFields(device);
          return (
            <li key={`${d.name}-${index}`} className="recording-system-row">
              <div className="recording-system-identity">
                <span className="recording-system-name">{d.name || '(unnamed)'}</span>
                {index === 0 && <span className="recording-system-default-badge">Default</span>}
                <span className="recording-system-meta">
                  {[d.system, d.amplifier, d.adc_circuit].filter(Boolean).join(' · ')}
                </span>
              </div>
              <div className="recording-system-actions">
                <button
                  type="button"
                  className="button-small"
                  onClick={() => openEdit(index)}
                  aria-label={`Edit recording system ${d.name}`}
                >
                  Edit
                </button>
                {catalog.length > 1 && (
                  <button
                    type="button"
                    className="button-small button-danger"
                    onClick={() => deleteAt(index)}
                    aria-label={`Delete recording system ${d.name}`}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {!editing && (
        <button type="button" className="button-secondary add-recording-system" onClick={openAdd}>
          + Add recording system
        </button>
      )}

      {/* Add / edit editor */}
      {editing && (
        <form className="data-acq-form recording-system-editor" aria-label="Recording system editor">
          <div className="form-group">
            <label htmlFor="data_acq_name">
              Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="data_acq_name"
              ref={nameInputRef}
              value={editing.fields.name}
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
              value={editing.fields.system}
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
              value={editing.fields.amplifier}
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
              value={editing.fields.adc_circuit}
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
                The name “{editing.fields.name.trim()}” is already used by {divergence.existing.label}{' '}
                with different hardware. The same data-acq name must mean the same device.
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
                      <td>{String(editing.fields[field] ?? '')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="recording-system-editor-actions">
            <button type="button" className="button-secondary" onClick={cancelEdit}>
              Cancel
            </button>
            <button type="button" className="button-primary" onClick={saveEditor}>
              Save recording system
            </button>
          </div>
        </form>
      )}

      {/* Technical defaults (seeded into new days) */}
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
            <label htmlFor="raw_data_to_volts">Raw Data to Volts</label>
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
              Conversion factor for electrophysiology signals (must be &gt; 0)
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="times_period_multiplier">Times Period Multiplier</label>
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
              Timestamp multiplier (must be &gt; 0)
            </small>
          </div>
        </div>
      </details>
    </div>
  );
}

DataAcqSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string,
    devices: PropTypes.shape({ data_acq_device: rawArray(PropTypes.object) }),
    technicalDefaults: PropTypes.object,
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  dataAcqRegistry: PropTypes.arrayOf(PropTypes.object),
};

DataAcqSection.defaultProps = {
  dataAcqRegistry: [],
};
