import { useState, useRef, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';
import HardwareConfigStep from './HardwareConfigStep';
import ElectrodeGroupsContainer from './wiring/ElectrodeGroupsContainer';
import ChannelMapsContainer from './wiring/ChannelMapsContainer';
import OptogeneticsContainer from './wiring/OptogeneticsContainer';
import AnimalProfileSection from './AnimalProfileSection';
import AlertModal from '../../components/AlertModal';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import ReconfigurationContextBanner from '../../components/ReconfigurationContextBanner';
import { parseReconfigContext, useReconfigContext } from '../../hooks/useReconfigContext';
import { animalEditorStepForFieldPath } from '../../domain/validation';
import { applyRepairCommand } from '../../state/repairCommands';
import './AnimalEditorStepper.scss';

// Route-context parsing (`?context=reconfigure&version=&fromDay=&movedDays=` + `?field=`) and the
// reconfiguration banner are shared with the tabbed Animal View — see
// ../../hooks/useReconfigContext + ../../components/ReconfigurationContextBanner.

/**
 * Animal Editor Stepper - Container for multi-step animal device configuration
 *
 * Manages the 4-step workflow for animal-level configuration:
 * 1. Electrode Groups - Configure device types, locations, coordinates
 * 2. Channel Maps - Configure logical-to-hardware channel mappings
 * 3. Optogenetics - Enable/configure the animal-level opto sections (off by default)
 * 4. Recording System, Cameras & DIO - Configure the recording system (data-acq device +
 *    technical defaults), cameras, and behavioral/DIO events (kept last so its Save/Continue
 *    flow is unchanged by the inserted Optogenetics step)
 *
 * Note: Component receives no props - animal ID is obtained from URL via
 * useAnimalIdFromUrl hook.
 *
 * @returns {JSX.Element}
 *
 * @example
 * // URL: #/animal/remy/editor
 * <AnimalEditorStepper />
 */
export default function AnimalEditorStepper() {
  const animalId = useAnimalIdFromUrl();
  const routeContext = useReconfigContext();
  const { model, actions } = useStoreContext();
  // Deep-link: a repair routed here as `?field=<path>` opens the Animal Editor on the
  // step that owns that field (channel maps / electrode groups / hardware) instead of
  // dropping the target and landing on step 0. Read at mount via the initializer.
  const [activeStep, setActiveStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const initial = parseReconfigContext(window.location.hash);
    return initial.field ? animalEditorStepForFieldPath(initial.field).index : 0;
  });
  // If a NEW repair field arrives while the editor is already mounted (a hashchange to a
  // different `?field=` rather than a fresh route mount), jump to that field's owning
  // step. Keyed on the field string so plain step navigation (which never changes the
  // hash) does not re-trigger it. The mount-time initializer above covers fresh routes.
  const lastFieldRef = useRef(routeContext.field);
  useEffect(() => {
    if (routeContext.field && routeContext.field !== lastFieldRef.current) {
      lastFieldRef.current = routeContext.field;
      setActiveStep(animalEditorStepForFieldPath(routeContext.field).index);
    }
  }, [routeContext.field]);
  // In-app feedback replacing native alert()/confirm().
  const [alertState, setAlertState] = useState({ isOpen: false, message: '', type: 'info', title: 'Alert', onClose: null });

  // Global Alt+Arrow shortcuts advance/retreat the stepper. Declared before the
  // early returns below to satisfy the Rules of Hooks; the step count is filled in
  // once `steps` is built further down (stepCountRef.current = steps.length).
  const stepCountRef = useRef(1);
  // The current step's "add" handler (Alt+N), or null when the step has no add
  // target. Filled in below once the handlers + active step are known.
  const addHandlerRef = useRef(null);
  useStepperShortcut(
    useCallback((action) => {
      if (action === 'add') {
        addHandlerRef.current?.();
        return;
      }
      setActiveStep((cur) => {
        if (action === 'next') return Math.min(cur + 1, stepCountRef.current - 1);
        if (action === 'prev') return Math.max(cur - 1, 0);
        return cur;
      });
    }, [])
  );

  /**
   * Show a non-blocking alert dialog. Optional onClose runs after the user dismisses
   * it (used to defer navigation until the message has been seen).
   * @param {string} message Message to display.
   * @param {('info'|'success'|'warning'|'error')} [type] Alert type.
   * @param {Function|null} [onClose] Optional action to run on dismiss.
   * @param {string} [title] Dialog title (defaults to a sensible label per type).
   */
  function showAlert(message, type = 'success', onClose = null, title) {
    const defaultTitle = { success: 'Success', error: 'Error', warning: 'Warning', info: 'Notice' }[type] || 'Notice';
    setAlertState({ isOpen: true, message, type, title: title || defaultTitle, onClose });
  }

  /**
   * Dismiss the alert dialog and run any deferred onClose action.
   */
  function handleAlertClose() {
    const deferred = alertState.onClose;
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (deferred) deferred();
  }

  // Validate animal exists
  const animal = animalId ? model.workspace.animals[animalId] : null;

  if (!animalId) {
    return <AnimalEditorError message="No animal specified in URL." />;
  }

  if (!animal) {
    return <AnimalEditorError message={`Animal "${animalId}" not found.`} />;
  }

  // Step navigation handlers
  /**
   * Move to next step
   */
  function handleNext() {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  }

  /**
   * Move to previous step
   */
  function handleBack() {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }

  /**
   * Save animal configuration and navigate based on context
   *
   * Context-aware navigation:
   * - If animal has NO days: Navigate to workspace with create-day action
   * - If animal has days: Navigate to workspace devices section
   *
   * Success message shows how many days will inherit the changes
   */
  function handleSave() {
    // Configuration already saved via updateAnimal calls throughout editing
    // Just need to determine navigation destination

    const dayCount = getAnimalDayIds(animal).length;
    const hasDays = dayCount > 0;

    // Show success message, then navigate once the user dismisses it.
    if (hasDays) {
      showAlert(
        // Accurate inheritance: device edits apply to the LATEST configuration; days pinned to
        // an earlier version keep theirs — so we don't claim all N days inherit the change.
        'Configuration saved to the latest version. Recording days on the latest version will ' +
          'use these changes; days pinned to an earlier version keep theirs. Close to return to ' +
          'the workspace.',
        'success',
        () => {
          window.location.hash = `#/workspace?animal=${animalId}&section=devices`;
        },
        'Configuration Saved'
      );
    } else {
      showAlert(
        'Configuration saved. Ready to create first recording day. Close to return to the workspace.',
        'success',
        () => {
          window.location.hash = `#/workspace?animal=${animalId}&action=create-day`;
        },
        'Configuration Saved'
      );
    }
  }

  /**
   * Handle field updates from step components
   * @param {string} field - Field name (e.g., "cameras", "data_acq_device", "behavioral_events")
   * @param {any} value - New value
   */
  function handleFieldUpdate(field, value) {
    // Update animal with new field value
    actions.updateAnimal(animalId, {
      [field]: value,
    });
  }

  /**
   * Execute a raw-shape corruption's repair command in place (the destination-side half of
   * the corruption contract). The animal-owned commands (resetAnimalCameras /
   * resetDataAcqDevice / rebuildConfigurationHistory) need only `actions` + `animalId` +
   * `animal`, which this editor owns. Routed to the shell-level RawCorruptionBanner below.
   *
   * @param {object} issue - A raw-shape issue carrying a `repairCommand`.
   */
  function handleRepair(issue) {
    if (!issue?.repairCommand) return;
    applyRepairCommand(issue.repairCommand, { actions, animalId, animal });
  }

  // Step configuration. Phase 8.7 Task 2c: user-facing step labels use scientist language
  // (the screen-map targets) rather than schema/implementation terms.
  const steps = [
    {
      label: 'Electrodes & Ephys',
      // `addRef` lets the container register its "add group" handler so the stepper's Alt+N
      // shortcut still adds a group on this step (the container owns the add modal now).
      component: <ElectrodeGroupsContainer animalId={animalId} addRef={addHandlerRef} />,
    },
    {
      label: 'Channel Maps',
      component: <ChannelMapsContainer animalId={animalId} />,
    },
    {
      label: 'Optogenetics Setup',
      component: <OptogeneticsContainer animalId={animalId} />,
    },
    {
      // Kept as the final step so its Save/Continue flow (and the stepper's final-step
      // Save button) is unchanged by the added Optogenetics step. Phase 8.7 Task 2: the
      // user-facing label names the three shared-setup areas it holds (recording system +
      // cameras + behavioral/DIO events) instead of the over-broad "Hardware Config".
      label: 'Recording System, Cameras & DIO',
      component: (
        <HardwareConfigStep
          animal={animal}
          onFieldUpdate={handleFieldUpdate}
          onNavigateBack={handleBack}
          onNavigateNext={handleSave}
        />
      ),
    },
  ];

  // Check if we're on the final step
  const isOnFinalStep = activeStep === steps.length - 1;
  // Keep the shortcut handler's step count current (the ref + hook are declared up top,
  // before the early returns, to satisfy the Rules of Hooks). The Alt+N "add" target is
  // registered into `addHandlerRef` by ElectrodeGroupsContainer while it is mounted (step 0),
  // and cleared on unmount — so other steps have no add target.
  stepCountRef.current = steps.length;

  return (
    <div className="animal-editor-stepper">
      {/* Plain div, not <header>/<footer> (below): those map to the banner /
          contentinfo landmarks here, duplicating AppLayout's. */}
      <div className="animal-editor-header">
        <a
          href={`#/workspace?animal=${animal.id}`}
          className="back-button"
          aria-label="Back to workspace"
        >
          ← Back to Workspace
        </a>
        <div className="animal-editor-title">
          <h1>Animal Setup: {animal.id}</h1>
          {/* Frame the editor as SHARED animal setup, not a detached hardware form. Phase 8.7
              Task 2: be honest about blast radius per ownership kind — electrodes/probes are
              VERSIONED (each day keeps the configuration it was pinned to), but cameras and the
              recording system are shared animal-level setup with no per-day binding today, so
              editing them affects ALL recording days. (The day-used camera export binding —
              Task 5 — will later let past days keep the cameras they referenced.) */}
          <p className="animal-editor-subtitle">
            Shared setup for this animal. Electrodes/probes are versioned — each recording day
            keeps the configuration it was pinned to. Cameras and the recording system are shared
            animal-level setup: editing them affects all recording days.
          </p>
          <ReconfigurationContextBanner
            animal={animal}
            routeContext={routeContext}
            days={model.workspace.days}
          />
        </div>
      </div>

      {/* Phase 8.7 Task 2b: the discoverable owner for constant subject facts (species, sex, DOB,
          genotype, description). Sits outside the device stepper (not a numbered step), so it
          does not shift step indices; editing here names its animal-wide blast radius before save.
          The Day Overview keeps inline subject repair, but is no longer the ONLY way to correct
          shared subject facts. */}
      <AnimalProfileSection
        animal={animal}
        dayCount={getAnimalDayIds(animal).length}
        onSave={(subject) => actions.updateAnimal(animalId, { subject })}
      />

      {/* Charter decision 1: the 3-field corruption banner is hoisted ABOVE the steps (was per-step
          in HardwareConfigStep) so corruption in cameras / data_acq_device / configurationHistory is
          visible from EVERY step, not hidden until the user reaches the hardware step. Self-hides
          when clean. */}
      <RawCorruptionBanner
        animal={animal}
        fields={['cameras', 'data_acq_device', 'configurationHistory']}
        onRepair={handleRepair}
      />

      {/* Step indicators */}
      <nav className="animal-editor-step-nav" aria-label="Configuration steps">
        <ul className="step-indicators">
          {steps.map((step, index) => (
            <li
              key={index}
              className={`step-indicator ${activeStep === index ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
            >
              <button
                className="step-indicator-button"
                onClick={() => setActiveStep(index)}
                aria-label={`Step ${index + 1}: ${step.label}${
                  activeStep === index
                    ? ' (current)'
                    : index < activeStep
                      ? ' (completed)'
                      : ''
                }`}
                aria-current={activeStep === index ? 'step' : undefined}
              >
                <span className="step-number">{index + 1}</span>
                <span>{step.label}</span>
                {/* Status conveyed beyond color (WCAG 1.4.1) for screen readers. */}
                {index < activeStep && activeStep !== index && (
                  <span className="sr-only"> (completed)</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Announce the active step to screen readers on change (matches the
          DayEditor route announcer pattern). */}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {`Step ${activeStep + 1} of ${steps.length}: ${steps[activeStep].label}`}
      </div>

      {/* Active step content. role/aria-label live here now that the duplicate
          <main> wrapper in index.jsx has been removed (single main per view). */}
      <main
        className="animal-editor-content"
        id="main-content"
        role="main"
        aria-label="Animal editor"
        tabIndex="-1"
      >
        {steps[activeStep].component}
      </main>

      {/* Navigation buttons (plain div, not <footer> — see header note above) */}
      <div className="animal-editor-footer">
        <button
          onClick={handleBack}
          disabled={activeStep === 0}
          className="footer-nav-button btn-back"
          aria-label="Go to previous step"
        >
          Back
        </button>
        <button
          onClick={isOnFinalStep ? handleSave : handleNext}
          disabled={false}
          className="footer-nav-button btn-next"
          aria-label={isOnFinalStep ? 'Save configuration' : 'Go to next step'}
        >
          {isOnFinalStep ? 'Save' : 'Next'}
        </button>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        message={alertState.message}
        title={alertState.title}
        type={alertState.type}
        onClose={handleAlertClose}
      />
    </div>
  );
}

/**
 * Error screen for the Animal Editor when the animal can't be resolved. Provides
 * its own landmark/focus target and navigation escapes so it is never a dead-end.
 *
 * @param {object} props
 * @param {string} props.message - The error message to display.
 * @returns {JSX.Element}
 */
function AnimalEditorError({ message }) {
  return (
    <main
      id="main-content"
      role="main"
      tabIndex="-1"
      aria-label="Error"
      className="error-state"
    >
      <h2>Error</h2>
      <p>{message}</p>
      <p>
        <a href="#/workspace">Return to Workspace</a>
        {' · '}
        <a href="#/home">Go to Home</a>
      </p>
    </main>
  );
}

AnimalEditorError.propTypes = {
  message: PropTypes.string.isRequired,
};
