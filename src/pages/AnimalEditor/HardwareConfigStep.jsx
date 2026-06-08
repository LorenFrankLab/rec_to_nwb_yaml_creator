import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import { rawArray } from '../../components/rawPropTypes';
import SaveIndicator from '../DayEditor/SaveIndicator';
import CamerasContainer from './wiring/CamerasContainer';
import RecordingSystemContainer from './wiring/RecordingSystemContainer';
import DioContainer from './wiring/DioContainer';
import './HardwareConfigStep.scss';

/**
 * HardwareConfigStep - Animal Editor final step: Recording System, Cameras & DIO Events.
 *
 * A thin composition of the three extracted setup containers (cameras / recording system / DIO)
 * plus the shared 3-field corruption banner. The stateful wiring — camera identity-safety,
 * immutable-once-referenced decisions, the data-acq identity registry — now lives in those
 * containers, so the tabbed Animal View renders the SAME implementation (one section per tab)
 * without forking the logic.
 *
 * @param {object} props
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field update callback from AnimalEditorStepper.
 * @param {Function} props.onNavigateBack - Navigate back to Step 2 (Channel Maps).
 * @param {Function} props.onNavigateNext - Navigate to Step 4 (Optogenetics) or exit.
 * @param props.onRepair
 * @returns {JSX.Element}
 */
export default function HardwareConfigStep({
  animal,
  onFieldUpdate,
  onNavigateBack,
  onNavigateNext,
  onRepair,
}) {
  const { persistence } = useStoreContext();

  return (
    <div className="hardware-config-step">
      <header className="step-header">
        <h2>Recording System, Cameras & DIO Events</h2>
        <SaveIndicator
          enabled={persistence.enabled}
          lastSaved={persistence.lastSaved}
          error={persistence.saveError}
          pending={persistence.hasPendingWrite}
        />
      </header>

      <div className="step-content">
        {/* Destination repair surface: a corrupt cameras / data_acq_device /
            configurationHistory would otherwise hide behind a section's empty state. The
            banner surfaces it with an executable reset, so a repair routed here is never a
            dead-end. (Phase 3 moves this banner to the AnimalView level so it spans the split
            setup tabs; for now it stays here for the legacy stepper.) */}
        <RawCorruptionBanner
          animal={animal}
          fields={['cameras', 'data_acq_device', 'configurationHistory']}
          onRepair={onRepair}
        />

        {/* Phase 8.7 Task 2: data acquisition belongs with the RECORDING SYSTEM (ephys), not
            lumped with cameras — give each area its own ownership-named section so the user can
            tell shared recording-system setup, the camera catalog, and the DIO event library
            apart. The section wiring lives in the extracted containers so the tabbed Animal View
            renders the SAME implementation, one section per tab. */}
        <section className="section-elevation-1" aria-label="Video Cameras & Calibration">
          <CamerasContainer animal={animal} onFieldUpdate={onFieldUpdate} />
        </section>

        <section className="section-elevation-0" aria-label="Recording System">
          <RecordingSystemContainer animal={animal} onFieldUpdate={onFieldUpdate} />
        </section>

        <section className="section-elevation-1" aria-label="Behavioral Events / DIO">
          <DioContainer animal={animal} onFieldUpdate={onFieldUpdate} />
        </section>
      </div>

      <footer className="step-footer">
        <button type="button" className="button-secondary" onClick={() => onNavigateBack?.()}>
          Back to Channel Maps
        </button>
        <button type="button" className="button-primary" onClick={() => onNavigateNext?.()}>
          Continue
        </button>
      </footer>
    </div>
  );
}

HardwareConfigStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Tolerant: this step is a repair destination for corrupt animal hardware.
    cameras: rawArray(PropTypes.object),
    devices: PropTypes.object,
    technicalDefaults: PropTypes.object,
    behavioral_events: rawArray(PropTypes.object),
  }).isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  onNavigateBack: PropTypes.func,
  onNavigateNext: PropTypes.func,
  onRepair: PropTypes.func,
};

HardwareConfigStep.defaultProps = {
  onNavigateBack: null,
  onNavigateNext: null,
  onRepair: undefined,
};
