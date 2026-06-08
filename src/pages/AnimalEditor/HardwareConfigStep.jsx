import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
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
 * The 3-field corruption banner (cameras / data_acq_device / configurationHistory) no longer
 * renders here: it is hoisted to the host shell (AnimalEditorStepper for the legacy stepper,
 * AnimalView for the tabbed view) so a corrupt sibling field can't hide behind a step/tab the user
 * isn't on (charter decision 1).
 *
 * @param {object} props.animal - Animal record.
 * @param {Function} props.onFieldUpdate - Field update callback from AnimalEditorStepper.
 * @param {Function} props.onNavigateBack - Navigate back to Step 2 (Channel Maps).
 * @param {Function} props.onNavigateNext - Navigate to Step 4 (Optogenetics) or exit.
 * @returns {JSX.Element}
 */
export default function HardwareConfigStep({
  animal,
  onFieldUpdate,
  onNavigateBack,
  onNavigateNext,
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
        {/* The 3-field corruption banner is hoisted to the host shell (AnimalEditorStepper /
            AnimalView) so a corrupt sibling field can't hide behind a step/tab the user isn't on
            (charter decision 1). It no longer renders per-step here. */}

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
};

HardwareConfigStep.defaultProps = {
  onNavigateBack: null,
  onNavigateNext: null,
};
