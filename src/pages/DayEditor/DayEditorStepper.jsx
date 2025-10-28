import { useState, useCallback, useMemo } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from './validation';
import StepNavigation from './StepNavigation';
import SaveIndicator from './SaveIndicator';
import OverviewStep from './OverviewStep';
import DevicesStub from './DevicesStub';
import EpochsStub from './EpochsStub';
import ValidationStub from './ValidationStub';
import ExportStub from './ExportStub';
import ErrorState from './ErrorState';

/**
 * Day Editor Stepper - Container for multi-step session metadata editing
 *
 * Manages the day editor workflow with 5 steps:
 * 1. Overview - Session metadata (M5 - implemented)
 * 2. Devices - Electrode groups, cameras (M6 - stub)
 * 3. Epochs - Tasks, behavioral events (M7 - stub)
 * 4. Validation - Summary of all errors (M9 - stub)
 * 5. Export - Download YAML file (M10 - stub)
 *
 * @returns {JSX.Element}
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * <DayEditorStepper />
 */
export default function DayEditorStepper() {
  const { model, actions } = useStoreContext();
  const dayId = useDayIdFromUrl();
  const [currentStep, setCurrentStep] = useState('overview');
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Get day and animal from store
  const day = model.workspace?.days?.[dayId];
  const animal = day ? model.workspace?.animals?.[day.animalId] : null;

  // Merge animal + day for validation (must be before early returns to follow Rules of Hooks)
  const mergedDay = useMemo(() => {
    if (!animal || !day) return null;
    return mergeDayMetadata(animal, day);
  }, [animal, day]);

  // Compute step validation status (must be before early returns to follow Rules of Hooks)
  const stepStatus = useMemo(() => {
    if (!day || !mergedDay) {
      return {
        overview: 'incomplete',
        devices: 'incomplete',
        epochs: 'incomplete',
        validation: 'incomplete',
        export: 'error',
      };
    }
    return computeStepStatus(day, mergedDay);
  }, [day, mergedDay]);

  // Field update handler with nested path support
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    if (!day || !dayId) return;

    try {
      // Parse path: "session.session_id" → ["session", "session_id"]
      const pathSegments = fieldPath.split('.');

      // Clone day and update nested field immutably
      const updated = structuredClone(day);
      let target = updated;
      for (let i = 0; i < pathSegments.length - 1; i++) {
        target = target[pathSegments[i]];
      }
      target[pathSegments[pathSegments.length - 1]] = value;

      // Extract top-level keys that changed
      const topLevelKey = pathSegments[0];
      const updates = { [topLevelKey]: updated[topLevelKey] };

      // Update store
      actions.updateDay(dayId, updates);

      // Update save status
      setLastSaved(new Date().toISOString());
      setSaveError(null);

    } catch (error) {
      console.error('Failed to update field:', error);
      setSaveError(`Failed to save ${fieldPath}: ${error.message}`);
    }
  }, [day, dayId, actions]);

  // Step configuration
  const steps = [
    { id: 'overview', label: 'Overview', component: OverviewStep },
    { id: 'devices', label: 'Devices', component: DevicesStub },
    { id: 'epochs', label: 'Epochs', component: EpochsStub },
    { id: 'validation', label: 'Validation', component: ValidationStub },
    { id: 'export', label: 'Export', component: ExportStub },
  ];

  // Early returns AFTER all hooks (Rules of Hooks requirement)
  if (!dayId) {
    return <ErrorState message="No day ID provided in URL" />;
  }

  if (!day) {
    return <ErrorState message={`Day not found: ${dayId}`} />;
  }

  if (!animal) {
    return <ErrorState message={`Animal not found: ${day.animalId}`} />;
  }

  const CurrentStepComponent = steps.find(s => s.id === currentStep).component;

  return (
    <div className="day-editor-stepper">
      <header className="day-editor-header">
        <div className="day-editor-title">
          <a
            href={`#/workspace?animal=${animal.id}`}
            className="back-button"
            aria-label="Back to workspace"
          >
            ← Back
          </a>
          <h1>Day Editor: {animal.id} - {day.date}</h1>
        </div>
        <SaveIndicator lastSaved={lastSaved} error={saveError} />
      </header>

      <StepNavigation
        steps={steps}
        currentStep={currentStep}
        stepStatus={stepStatus}
        onNavigate={setCurrentStep}
      />

      <main id="main-content" className="day-editor-content" tabIndex="-1">
        <CurrentStepComponent
          animal={animal}
          day={day}
          mergedDay={mergedDay}
          onFieldUpdate={handleFieldUpdate}
        />
      </main>
    </div>
  );
}

DayEditorStepper.propTypes = {};
