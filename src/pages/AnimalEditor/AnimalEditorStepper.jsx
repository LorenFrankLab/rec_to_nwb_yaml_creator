import { useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';

/**
 * Animal Editor Stepper - Container for multi-step animal device configuration
 *
 * Manages the 2-step workflow for animal-level configuration:
 * 1. Electrode Groups - Configure device types, locations, coordinates
 * 2. Channel Maps - Configure logical-to-hardware channel mappings
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
  const { model } = useStoreContext();
  const [activeStep, setActiveStep] = useState(0);

  // Validate animal exists
  const animal = animalId ? model.workspace.animals[animalId] : null;

  if (!animalId) {
    return <div>Error: No animal specified in URL</div>;
  }

  if (!animal) {
    return <div>Error: Animal &quot;{animalId}&quot; not found</div>;
  }

  // Step navigation handlers
  /**
   *
   */
  function handleNext() {
    if (activeStep < steps.length - 1) {
      setActiveStep(activeStep + 1);
    }
  }

  /**
   *
   */
  function handleBack() {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  }

  // Step configuration
  const steps = [
    { label: 'Electrode Groups', component: <div>Electrode Groups (Step 1)</div> },
    { label: 'Channel Maps', component: <div>Channel Maps (Step 2)</div> },
  ];

  return (
    <div>
      <header>
        <h1>Animal Editor: {animal.id}</h1>
      </header>

      {/* Step indicators */}
      <div role="navigation" aria-label="Configuration steps">
        {steps.map((step, index) => (
          <div key={index} className={activeStep === index ? 'active' : ''}>
            {step.label}
          </div>
        ))}
      </div>

      {/* Active step content */}
      <main>
        {steps[activeStep].component}
      </main>

      {/* Navigation buttons */}
      <footer>
        <button
          onClick={handleBack}
          disabled={activeStep === 0}
          aria-label="Go to previous step"
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={activeStep === steps.length - 1}
          aria-label={activeStep === steps.length - 1 ? 'Save configuration' : 'Go to next step'}
        >
          {activeStep === steps.length - 1 ? 'Save' : 'Next'}
        </button>
      </footer>
    </div>
  );
}
