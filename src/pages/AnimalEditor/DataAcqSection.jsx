import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import { findIdentityDivergence, DATA_ACQ_DEPENDENT_FIELDS, IDENTITY_FIELD_LABELS } from './identitySafety';
import { getDataAcqDevices } from '../../state/workspaceSelectors';
import './DataAcqSection.scss';

const DEVICE_FIELDS = ['name', 'system', 'amplifier', 'adc_circuit'];
const REQUIRED_DEVICE_FIELDS = DEVICE_FIELDS;

/**
 *
 * @param fields
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
 *
 * @param device
 */
function isCompleteDevice(device) {
  return REQUIRED_DEVICE_FIELDS.every((field) => device[field]);
}

/**
 *
 * @param device
 */
function dependentFields(device) {
  return Object.fromEntries(DATA_ACQ_DEPENDENT_FIELDS.map((field) => [field, device[field]]));
}

/**
 * DataAcqSection - Data Acquisition Device + technical defaults (Animal Editor).
 *
 * The export reads `animal.devices.data_acq_device` as an ARRAY of
 * `{name, system, amplifier, adc_circuit}` (schema-required), so this section edits a
 * single device but persists it as a one-element array via
 * `onFieldUpdate('data_acq_device', [item])`. `name` is a Spyglass
 * `DataAcquisitionDevice` identity: reusing it elsewhere in the dataset with different
 * `system`/`amplifier`/`adc_circuit` is blocked here with a side-by-side comparison and
 * a steer to a new name.
 *
 * Technical DEFAULTS (`raw_data_to_volts`, `times_period_multiplier`) are edited here as
 * `animal.technicalDefaults` (seeded into each day's `technical` at createDay,
 * overridable per day). They are never exported directly. Per-day technical values
 * (`default_header_file_path`, `units`) are edited in the Day Editor, where the export
 * reads `day.technical`.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record (`devices.data_acq_device`, `technicalDefaults`).
 * @param {Function} props.onFieldUpdate - Field update callback.
 * @param {Array<{name: string, fields: object, label: string}>} [props.dataAcqRegistry] -
 *   Data-acq identities elsewhere in the dataset, for divergent-reuse detection.
 * @returns {JSX.Element}
 */
export default function DataAcqSection({ animal, onFieldUpdate, dataAcqRegistry = [] }) {
  // Read through the canonical selector: a corrupt non-array data_acq_device degrades to
  // no device instead of crashing this repair destination.
  const device = getDataAcqDevices(animal)[0] || {};
  const defaults = animal.technicalDefaults || {};
  const nameInputRef = useRef(null);

  const [localState, setLocalState] = useState({
    name: device.name || '',
    system: device.system || 'SpikeGadgets',
    amplifier: device.amplifier || '',
    adc_circuit: device.adc_circuit || '',
    raw_data_to_volts: defaults.raw_data_to_volts ?? 0.195,
    times_period_multiplier: defaults.times_period_multiplier ?? 1.5,
  });
  // Set when the current device fields would reuse another device's name with
  // divergent dependent values. Blocks the save until resolved.
  const [divergence, setDivergence] = useState(null);
  const [deviceError, setDeviceError] = useState('');

  const handleFieldChange = (field, value) => {
    setLocalState((prev) => ({ ...prev, [field]: value }));
  };

  /**
   * Persist the device (as a one-element array) unless its name diverges from an
   * existing data-acq identity; persist technical defaults directly.
   *
   * @param {string} field - The blurred field.
   * @param {object} nextState - The latest local state (post-change).
   */
  const commit = (field, nextState) => {
    if (DEVICE_FIELDS.includes(field)) {
      const candidate = normalizeDeviceFields(nextState);
      if (!isCompleteDevice(candidate)) {
        setDivergence(null);
        setDeviceError('Complete name, system, amplifier, and ADC circuit before saving this device.');
        return;
      }

      const savedDevice = normalizeDeviceFields(device);
      const savedIdentity = isCompleteDevice(savedDevice)
        ? [{
            name: savedDevice.name,
            label: `${animal.id} data-acq device saved identity`,
            fields: dependentFields(savedDevice),
          }]
        : [];
      const conflict = findIdentityDivergence(
        candidate.name,
        dependentFields(candidate),
        savedIdentity
      ) || findIdentityDivergence(
        candidate.name,
        dependentFields(candidate),
        dataAcqRegistry
      );
      if (conflict) {
        setDivergence(conflict);
        setDeviceError('');
        return; // Block: do not write a divergent reuse.
      }
      setDivergence(null);
      setDeviceError('');
      onFieldUpdate('data_acq_device', [candidate]);
      return;
    }
    onFieldUpdate('technicalDefaults', {
      raw_data_to_volts: nextState.raw_data_to_volts,
      times_period_multiplier: nextState.times_period_multiplier,
    });
  };

  // Commit on blur from the current local state. `commit` has side effects
  // (onFieldUpdate / setDivergence), so it must run outside any setState updater —
  // a state updater must stay pure (React may call it more than once).
  const handleBlur = (field) => {
    commit(field, localState);
  };

  const handleUseNewName = () => {
    setDivergence(null);
    if (nameInputRef.current) nameInputRef.current.focus();
  };

  const isValidPositive = (value) => value > 0;

  return (
    <div className="data-acq-section">
      <header className="section-header">
        <h2>Data Acquisition Device</h2>
        <p>Configure your recording hardware and technical parameters.</p>
      </header>

      <form className="data-acq-form">
        {/* Name (Spyglass identity) */}
        <div className="form-group">
          <label htmlFor="data_acq_name">
            Name <span className="required">*</span>
          </label>
          <input
            type="text"
            id="data_acq_name"
            ref={nameInputRef}
            value={localState.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            onBlur={() => handleBlur('name')}
            placeholder="e.g., SpikeGadgets_MCU"
            required
          />
          <small className="help-text">
            Identifies this acquisition device. The same name must mean the same hardware.
          </small>
        </div>

        {/* System Dropdown */}
        <div className="form-group">
          <label htmlFor="system">
            System <span className="required">*</span>
          </label>
          <select
            id="system"
            value={localState.system}
            onChange={(e) => handleFieldChange('system', e.target.value)}
            onBlur={() => handleBlur('system')}
            required
          >
            <option value="SpikeGadgets">SpikeGadgets</option>
            <option value="Open Ephys">Open Ephys</option>
            <option value="Intan">Intan</option>
            <option value="Other">Other</option>
          </select>
        </div>

        {/* Amplifier */}
        <div className="form-group">
          <label htmlFor="amplifier">
            Amplifier <span className="required">*</span>
          </label>
          <input
            type="text"
            id="amplifier"
            value={localState.amplifier}
            onChange={(e) => handleFieldChange('amplifier', e.target.value)}
            onBlur={() => handleBlur('amplifier')}
            placeholder="e.g., Intan RHD2000"
            required
          />
        </div>

        {/* ADC Circuit */}
        <div className="form-group">
          <label htmlFor="adc_circuit">
            ADC Circuit <span className="required">*</span>
          </label>
          <input
            type="text"
            id="adc_circuit"
            value={localState.adc_circuit}
            onChange={(e) => handleFieldChange('adc_circuit', e.target.value)}
            onBlur={() => handleBlur('adc_circuit')}
            placeholder="e.g., Intan"
            required
          />
        </div>

        {deviceError && (
          <div className="validation-error" role="alert">
            {deviceError}
          </div>
        )}

        {divergence && (
          <div className="identity-divergence" role="alert">
            <p className="identity-divergence-title">
              The name “{localState.name.trim()}” is already used by {divergence.existing.label} with
              different hardware. The same data-acq name must mean the same device.
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
                    <td>{String(localState[field] ?? '')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="button" className="button-primary" onClick={handleUseNewName}>
              Use a new name
            </button>
          </div>
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
                value={Number.isFinite(localState.raw_data_to_volts) ? localState.raw_data_to_volts : ''}
                onChange={(e) => handleFieldChange('raw_data_to_volts', parseFloat(e.target.value))}
                onBlur={() => handleBlur('raw_data_to_volts')}
                step="0.0001"
                min="0"
                aria-invalid={!isValidPositive(localState.raw_data_to_volts)}
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
                value={Number.isFinite(localState.times_period_multiplier) ? localState.times_period_multiplier : ''}
                onChange={(e) => handleFieldChange('times_period_multiplier', parseFloat(e.target.value))}
                onBlur={() => handleBlur('times_period_multiplier')}
                step="0.0001"
                min="0"
                aria-invalid={!isValidPositive(localState.times_period_multiplier)}
                aria-describedby="times-help"
              />
              <small id="times-help" className="help-text">
                Timestamp multiplier (must be &gt; 0)
              </small>
            </div>
          </div>
        </details>
      </form>
    </div>
  );
}

DataAcqSection.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    devices: PropTypes.shape({
      data_acq_device: PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          system: PropTypes.string,
          amplifier: PropTypes.string,
          adc_circuit: PropTypes.string,
        })
      ),
    }),
    technicalDefaults: PropTypes.shape({
      raw_data_to_volts: PropTypes.number,
      times_period_multiplier: PropTypes.number,
    }),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  dataAcqRegistry: PropTypes.arrayOf(PropTypes.object),
};

DataAcqSection.defaultProps = {
  dataAcqRegistry: [],
};
