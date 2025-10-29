import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import CamerasSection from './CamerasSection';
import DataAcqSection from './DataAcqSection';
import BehavioralEventsSection from './BehavioralEventsSection';
import SaveIndicator from '../DayEditor/SaveIndicator';
import './HardwareConfigStep.scss';

/**
 * HardwareConfigStep - Animal Editor Step 3: Cameras, Hardware & Behavioral Events (M8a Task 5)
 *
 * Container component that renders 3 child sections for configuring recording hardware:
 * 1. Cameras (elevation 1) - Video recording devices
 * 2. Data Acquisition Device (elevation 0) - Electrophysiology hardware
 * 3. Behavioral Events (elevation 1) - DIO channel definitions
 *
 * Features:
 * - 3-section layout with proper elevation hierarchy
 * - SaveIndicator integration for autosave feedback
 * - Error handling with try-catch
 * - Navigation buttons (Back to Channel Maps, Continue to Optogenetics or Exit)
 * - State management for each section
 * - PropTypes and JSDoc documentation
 *
 * @param {object} props
 * @param {object} props.animal - Animal record with cameras, data_acq_device, technical, behavioral_events
 * @param {Function} props.onFieldUpdate - Field update callback from AnimalEditorStepper
 * @param {Function} props.onNavigateBack - Navigate back to Step 2 (Channel Maps)
 * @param {Function} props.onNavigateNext - Navigate to Step 4 (Optogenetics) or exit
 * @returns {JSX.Element}
 *
 * @example
 * <HardwareConfigStep
 *   animal={animal}
 *   onFieldUpdate={handleFieldUpdate}
 *   onNavigateBack={handleBack}
 *   onNavigateNext={handleNext}
 * />
 */
export default function HardwareConfigStep({
  animal,
  onFieldUpdate,
  onNavigateBack,
  onNavigateNext,
}) {
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  /**
   * Wrapped field update handler with save indicator feedback
   * @param {string} fieldPath - Field path (e.g., "cameras", "data_acq_device", "behavioral_events")
   * @param {any} value - New value
   */
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    try {
      // Show saving indicator
      setSaveError(null);

      // Call parent handler
      onFieldUpdate(fieldPath, value);

      // Update last saved timestamp
      setLastSaved(new Date().toISOString());
    } catch (error) {
      console.error('Failed to save field:', error);
      setSaveError(`Failed to save ${fieldPath}: ${error.message}`);
    }
  }, [onFieldUpdate]);

  /**
   * Handle Back button click
   */
  const handleBackClick = () => {
    if (onNavigateBack) {
      onNavigateBack();
    }
  };

  /**
   * Handle Continue button click
   */
  const handleContinueClick = () => {
    if (onNavigateNext) {
      onNavigateNext();
    }
  };

  return (
    <div className="hardware-config-step">
      <header className="step-header">
        <h2>Cameras, Hardware & Behavioral Events</h2>
        <SaveIndicator lastSaved={lastSaved} error={saveError} />
      </header>

      <div className="step-content">
        {/* Section 1: Cameras (Elevation 1) */}
        <section className="section-elevation-1" aria-labelledby="cameras-heading">
          <CamerasSection
            animal={animal}
            onFieldUpdate={handleFieldUpdate}
          />
        </section>

        {/* Section 2: Data Acquisition Device (Elevation 0) */}
        <section className="section-elevation-0" aria-labelledby="data-acq-heading">
          <DataAcqSection
            animal={animal}
            onFieldUpdate={handleFieldUpdate}
          />
        </section>

        {/* Section 3: Behavioral Events (Elevation 1) */}
        <section className="section-elevation-1" aria-labelledby="behavioral-events-heading">
          <BehavioralEventsSection
            animal={animal}
            onFieldUpdate={handleFieldUpdate}
          />
        </section>
      </div>

      {/* Navigation Footer */}
      <footer className="step-footer">
        <button
          type="button"
          className="button-secondary"
          onClick={handleBackClick}
        >
          Back to Channel Maps
        </button>
        <button
          type="button"
          className="button-primary"
          onClick={handleContinueClick}
        >
          Continue
        </button>
      </footer>
    </div>
  );
}

HardwareConfigStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    cameras: PropTypes.arrayOf(PropTypes.object),
    data_acq_device: PropTypes.object,
    technical: PropTypes.object,
    behavioral_events: PropTypes.arrayOf(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onNavigateBack: PropTypes.func,
  onNavigateNext: PropTypes.func,
};

HardwareConfigStep.defaultProps = {
  onNavigateBack: null,
  onNavigateNext: null,
};
