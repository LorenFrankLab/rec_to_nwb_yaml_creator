import { useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';
import ElectrodeGroupsStep from './ElectrodeGroupsStep';
import ElectrodeGroupModal from './ElectrodeGroupModal';

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
  const { model, actions } = useStoreContext();
  const [activeStep, setActiveStep] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingGroup, setEditingGroup] = useState(null);

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

  // Electrode groups modal handlers
  /**
   * Open modal in add mode
   */
  function handleAddGroup() {
    setModalMode('add');
    setEditingGroup(null);
    setModalOpen(true);
  }

  /**
   * Open modal in edit mode with selected group
   * @param {object} group - Electrode group to edit
   */
  function handleEditGroup(group) {
    setModalMode('edit');
    setEditingGroup(group);
    setModalOpen(true);
  }

  /**
   * Save electrode group (add or edit)
   * @param {object} groupData - Form data from modal
   */
  function handleSaveGroup(groupData) {
    const updatedGroups = modalMode === 'add'
      ? [...animal.devices.electrode_groups, { ...groupData, id: Date.now().toString() }]
      : animal.devices.electrode_groups.map(g =>
        g.id === editingGroup.id ? { ...g, ...groupData } : g
      );

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        electrode_groups: updatedGroups,
      },
    });

    setModalOpen(false);
  }

  /**
   * Cancel modal without saving
   */
  function handleCancelModal() {
    setModalOpen(false);
  }

  /**
   * Handle field updates from ElectrodeGroupsStep
   * @param {string} field - Field name
   * @param {any} value - New value
   */
  function handleFieldUpdate(field, value) {
    // Placeholder for future field updates
    // This callback would handle inline edits or other field changes
  }

  // Step configuration
  const steps = [
    {
      label: 'Electrode Groups',
      component: (
        <ElectrodeGroupsStep
          animal={animal}
          onFieldUpdate={handleFieldUpdate}
          onAdd={handleAddGroup}
          onEdit={handleEditGroup}
        />
      ),
    },
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

      {/* Electrode Groups Modal */}
      <ElectrodeGroupModal
        isOpen={modalOpen}
        mode={modalMode}
        group={editingGroup}
        onSave={handleSaveGroup}
        onCancel={handleCancelModal}
      />
    </div>
  );
}
