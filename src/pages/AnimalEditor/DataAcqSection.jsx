import { useState, useRef } from 'react';
import PropTypes from 'prop-types';
import './DataAcqSection.scss';

/**
 * DataAcqSection - Data Acquisition Device configuration section (M8a Task 3)
 *
 * Single form (not table - only one device per animal) for configuring
 * data acquisition hardware and technical parameters.
 *
 * Features:
 * - System dropdown (SpikeGadgets, Open Ephys, etc.)
 * - Amplifier and ADC circuit text inputs
 * - Default header file path with file browser
 * - Collapsible "Advanced Settings" for ephys_to_volt and times_multiplier
 * - Validation: conversion factors must be > 0
 * - Debounced save on blur
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with data_acq_device and technical
 * @param {Function} props.onFieldUpdate - Field update callback
 * @returns {JSX.Element}
 */
export default function DataAcqSection({ animal, onFieldUpdate }) {
  const fileInputRef = useRef(null);

  // Extract current values with defaults
  const dataAcqDevice = animal.data_acq_device || {};
  const technical = animal.technical || {};

  const [localState, setLocalState] = useState({
    system: dataAcqDevice.system || 'SpikeGadgets',
    amplifier: dataAcqDevice.amplifier || '',
    adc_circuit: dataAcqDevice.adc_circuit || '',
    default_header_file_path: technical.default_header_file_path || '',
    ephys_to_volt_conversion: technical.ephys_to_volt_conversion || 1.0,
    times_period_multiplier: technical.times_period_multiplier || 1.0,
  });

  /**
   * Handle field change with local state update
   * @param {string} field - Field name
   * @param {any} value - New value
   */
  const handleFieldChange = (field, value) => {
    setLocalState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  /**
   * Handle blur - save to parent with debounce
   * @param {string} field - Field name
   * @param {any} value - Value to save
   */
  const handleBlur = (field, value) => {
    // Determine which parent object to update
    if (field === 'system' || field === 'amplifier' || field === 'adc_circuit') {
      // Update data_acq_device
      onFieldUpdate('data_acq_device', {
        ...dataAcqDevice,
        [field]: value,
      });
    } else {
      // Update technical
      onFieldUpdate('technical', {
        ...technical,
        [field]: value,
      });
    }
  };

  /**
   * Handle file browser button click
   */
  const handleBrowseClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  /**
   * Handle file selection
   * @param {Event} event
   */
  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      // Get file path (or name as fallback since we can't access full path in browser)
      const filePath = file.name;
      setLocalState((prev) => ({
        ...prev,
        default_header_file_path: filePath,
      }));
      handleBlur('default_header_file_path', filePath);
    }
  };

  /**
   * Validate numeric input > 0
   * @param {number} value
   * @returns {boolean}
   */
  const isValidPositive = (value) => {
    return value > 0;
  };

  return (
    <div className="data-acq-section">
      <header className="section-header">
        <h2>Data Acquisition Device</h2>
        <p>Configure your recording hardware and technical parameters.</p>
      </header>

      <form className="data-acq-form">
        {/* System Dropdown */}
        <div className="form-group">
          <label htmlFor="system">
            System <span className="required">*</span>
          </label>
          <select
            id="system"
            value={localState.system}
            onChange={(e) => handleFieldChange('system', e.target.value)}
            onBlur={(e) => handleBlur('system', e.target.value)}
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
          <label htmlFor="amplifier">Amplifier</label>
          <input
            type="text"
            id="amplifier"
            value={localState.amplifier}
            onChange={(e) => handleFieldChange('amplifier', e.target.value)}
            onBlur={(e) => handleBlur('amplifier', e.target.value)}
            placeholder="e.g., Intan RHD2000"
          />
        </div>

        {/* ADC Circuit */}
        <div className="form-group">
          <label htmlFor="adc_circuit">ADC Circuit</label>
          <input
            type="text"
            id="adc_circuit"
            value={localState.adc_circuit}
            onChange={(e) => handleFieldChange('adc_circuit', e.target.value)}
            onBlur={(e) => handleBlur('adc_circuit', e.target.value)}
            placeholder="e.g., Intan"
          />
        </div>

        {/* Default Header File Path */}
        <div className="form-group">
          <label htmlFor="default_header_file_path">Default Header File</label>
          <div className="file-input-group">
            <input
              type="text"
              id="default_header_file_path"
              value={localState.default_header_file_path}
              onChange={(e) => handleFieldChange('default_header_file_path', e.target.value)}
              onBlur={(e) => handleBlur('default_header_file_path', e.target.value)}
              placeholder="/path/to/config.trodesconf"
            />
            <button
              type="button"
              className="button-secondary"
              onClick={handleBrowseClick}
              aria-label="Browse for file"
            >
              Browse...
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".trodesconf,.xml"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Advanced Settings - Collapsible */}
        <details className="advanced-settings">
          <summary>Advanced Settings</summary>
          <div className="advanced-content">
            <p className="help-text">
              ℹ️ Contact support before changing these values. Incorrect settings can corrupt data.
            </p>

            {/* Ephys to Volt Conversion */}
            <div className="form-group">
              <label htmlFor="ephys_to_volt_conversion">
                Ephys to Volt Conversion
              </label>
              <input
                type="number"
                id="ephys_to_volt_conversion"
                value={localState.ephys_to_volt_conversion}
                onChange={(e) => handleFieldChange('ephys_to_volt_conversion', parseFloat(e.target.value))}
                onBlur={(e) => handleBlur('ephys_to_volt_conversion', parseFloat(e.target.value))}
                step="0.0001"
                min="0"
                aria-invalid={!isValidPositive(localState.ephys_to_volt_conversion)}
                aria-describedby="ephys-help"
              />
              <small id="ephys-help" className="help-text">
                Conversion factor for electrophysiology signals (must be &gt; 0)
              </small>
            </div>

            {/* Times Period Multiplier */}
            <div className="form-group">
              <label htmlFor="times_period_multiplier">
                Times Period Multiplier
              </label>
              <input
                type="number"
                id="times_period_multiplier"
                value={localState.times_period_multiplier}
                onChange={(e) => handleFieldChange('times_period_multiplier', parseFloat(e.target.value))}
                onBlur={(e) => handleBlur('times_period_multiplier', parseFloat(e.target.value))}
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
    data_acq_device: PropTypes.shape({
      system: PropTypes.string,
      amplifier: PropTypes.string,
      adc_circuit: PropTypes.string,
    }),
    technical: PropTypes.shape({
      default_header_file_path: PropTypes.string,
      ephys_to_volt_conversion: PropTypes.number,
      times_period_multiplier: PropTypes.number,
    }),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
};
