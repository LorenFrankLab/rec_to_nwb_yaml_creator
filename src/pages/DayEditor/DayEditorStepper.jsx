import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useDayIdFromUrl } from '../../hooks/useDayIdFromUrl';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { computeStepStatus } from './validation';
import { isExportEnabled } from './stepGate';
import StepNavigation from './StepNavigation';
import SaveIndicator from './SaveIndicator';
import OverviewStep from './OverviewStep';
import DevicesStep from './DevicesStep';
import TasksEpochsStep from './TasksEpochsStep';
import ValidationStep from './ValidationStep';
import ExportStep from './ExportStep';
import ErrorState from './ErrorState';

/**
 * Day Editor Stepper - Container for multi-step session metadata editing
 *
 * Manages the day editor workflow with 5 steps:
 * 1. Overview - Session metadata
 * 2. Devices - Electrode groups, cameras
 * 3. Epochs - Tasks, behavioral events
 * 4. Validation - Summary of all validation issues
 * 5. Export - Download YAML file (gated until all prerequisite steps valid)
 *
 * @returns {JSX.Element}
 *
 * @example
 * // URL: #/day/remy-2023-06-22
 * <DayEditorStepper />
 */
export default function DayEditorStepper() {
  const { model, actions, selectors, persistence } = useStoreContext();
  const dayId = useDayIdFromUrl();
  const [currentStep, setCurrentStep] = useState('overview');

  // Global Alt+Arrow shortcuts advance/retreat this stepper. The step order is
  // fixed, so a ref captures it once and the handler stays stable.
  const stepOrderRef = useRef(['overview', 'devices', 'epochs', 'validation', 'export']);
  // Latest validation status, read by the keyboard handler at fire time so the
  // shortcut respects the SAME export gate as the click path (no advancing into a
  // gated Export). Updated each render below, after stepStatus is computed.
  const stepStatusRef = useRef(null);
  useStepperShortcut(
    useCallback((action) => {
      setCurrentStep((cur) => {
        const ids = stepOrderRef.current;
        const idx = ids.indexOf(cur);
        if (action === 'next') {
          const nextId = ids[Math.min(idx + 1, ids.length - 1)];
          // Fail closed: never let the keyboard cross into Export while it is gated.
          if (nextId === 'export' && !isExportEnabled(stepStatusRef.current)) {
            return cur;
          }
          return nextId;
        }
        if (action === 'prev') return ids[Math.max(idx - 1, 0)];
        return cur;
      });
    }, [])
  );

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
  // Keep the keyboard handler's view of the gate current (it reads this ref at
  // fire time rather than closing over a stale status).
  stepStatusRef.current = stepStatus;

  // Repair-action navigation. A repair routes to the step that owns the fix and,
  // when a field target is available, focuses/highlights that control after the
  // destination step renders. With no matching anchor it degrades to the step
  // itself (focusing the main content region).
  const [focusRequest, setFocusRequest] = useState(null);
  const focusTokenRef = useRef(0);
  const handleStepNavigate = useCallback((stepId, fieldPath) => {
    setCurrentStep(stepId);
    if (fieldPath) {
      focusTokenRef.current += 1;
      setFocusRequest({ fieldPath, token: focusTokenRef.current });
    } else {
      setFocusRequest(null);
    }
  }, []);

  useEffect(() => {
    if (!focusRequest) return undefined;
    let highlighted = null;
    let removeTimer = null;
    const raf = requestAnimationFrame(() => {
      const main = document.getElementById('main-content');
      if (!main) return;
      const target = Array.from(main.querySelectorAll('[data-field-path]')).find(
        (el) => el.getAttribute('data-field-path') === focusRequest.fieldPath
      );
      if (target) {
        target.focus();
        target.classList.add('repair-target-highlight');
        highlighted = target;
        // Transient cue: drop the highlight so it does not read as a persistent state.
        removeTimer = setTimeout(() => target.classList.remove('repair-target-highlight'), 2000);
      } else {
        // No precise anchor: land the user on the owning step's content.
        main.focus();
      }
    });
    return () => {
      cancelAnimationFrame(raf);
      if (removeTimer) clearTimeout(removeTimer);
      if (highlighted) highlighted.classList.remove('repair-target-highlight');
    };
  }, [focusRequest]);

  // Field update handler with nested path support. The write is synchronous; real
  // save status (and any failure) is reported by the store's debounced autosave via
  // `persistence`, not optimistically here.
  const handleFieldUpdate = useCallback((fieldPath, value) => {
    if (!day || !dayId) return;

    // Parse path: "session.session_id" → ["session", "session_id"]
    const pathSegments = fieldPath.split('.');

    // Clone day and update nested field immutably
    const updated = structuredClone(day);
    let target = updated;

    // Navigate to parent object, creating intermediate objects if they don't exist
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      if (!target[segment]) {
        target[segment] = {};
      }
      target = target[segment];
    }

    // Set the final value
    target[pathSegments[pathSegments.length - 1]] = value;

    // Extract top-level keys that changed and update the store.
    const topLevelKey = pathSegments[0];
    actions.updateDay(dayId, { [topLevelKey]: updated[topLevelKey] });
  }, [day, dayId, actions]);

  // Step configuration. Export stays gated by isExportEnabled (every prerequisite
  // step valid, including the now-real Validation step).
  const steps = [
    { id: 'overview', label: 'Overview', component: OverviewStep },
    { id: 'devices', label: 'Devices', component: DevicesStep },
    { id: 'epochs', label: 'Epochs', component: TasksEpochsStep },
    { id: 'validation', label: 'Validation', component: ValidationStep },
    { id: 'export', label: 'Export', component: ExportStep },
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

  // The animal's days (sorted by date) power the Devices step's reconfiguration
  // wizard (version legibility + apply-forward). Computed here where the store is.
  const animalDays = selectors.getAnimalDays(animal.id);

  return (
    <div className="day-editor-stepper">
      {/* Plain div, not <header>: a <header> here (not inside a sectioning element)
          maps to the banner landmark, duplicating AppLayout's banner. */}
      <div className="day-editor-header">
        <div className="day-editor-title">
          <a
            href={`#/workspace?animal=${animal.id}`}
            className="back-button"
            aria-label="Back to workspace"
          >
            ← Back to Workspace
          </a>
          <h1>Day Editor: {animal.id} - {day.date}</h1>
        </div>
        <SaveIndicator
          enabled={persistence.enabled}
          lastSaved={persistence.lastSaved}
          error={persistence.saveError}
          pending={persistence.hasPendingWrite}
        />
      </div>

      <StepNavigation
        steps={steps}
        currentStep={currentStep}
        stepStatus={stepStatus}
        onNavigate={handleStepNavigate}
      />

      <main
        id="main-content"
        className="day-editor-content"
        role="main"
        aria-label="Day editor"
        tabIndex="-1"
      >
        <CurrentStepComponent
          animal={animal}
          day={day}
          mergedDay={mergedDay}
          onFieldUpdate={handleFieldUpdate}
          onNavigate={handleStepNavigate}
          animalDays={animalDays}
          actions={actions}
        />
      </main>
    </div>
  );
}

DayEditorStepper.propTypes = {};
