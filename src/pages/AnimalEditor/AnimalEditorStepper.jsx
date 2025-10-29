import { useState, useRef } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';
import ElectrodeGroupsStep from './ElectrodeGroupsStep';
import ElectrodeGroupModal from './ElectrodeGroupModal';
import CopyFromAnimalDialog from './CopyFromAnimalDialog';
import ChannelMapsStep from './ChannelMapsStep';
import ChannelMapEditor from './ChannelMapEditor';
import { generateAllChannelMaps } from '../../utils/channelMapUtils';
import { downloadChannelMapsCSV, importChannelMapsFromCSV } from '../../utils/csvChannelMapUtils';
import './AnimalEditorStepper.scss';

/**
 * Generate next sequential electrode group ID
 * Finds max existing ID and increments by 1
 * @param {Array} existingGroups - Current electrode groups
 * @returns {string} Next ID (e.g., "0", "1", "2"...)
 */
function generateNextElectrodeGroupId(existingGroups) {
  if (!existingGroups || existingGroups.length === 0) {
    return '0';
  }

  const maxId = Math.max(
    ...existingGroups.map(g => {
      const parsed = parseInt(g.id, 10);
      return isNaN(parsed) ? 0 : parsed;
    })
  );

  return (maxId + 1).toString();
}

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
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const csvFileInputRef = useRef(null);

  // Validate animal exists
  const animal = animalId ? model.workspace.animals[animalId] : null;

  if (!animalId) {
    return <div className="error-state">Error: No animal specified in URL</div>;
  }

  if (!animal) {
    return <div className="error-state">Error: Animal &quot;{animalId}&quot; not found</div>;
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

    const hasDays = animal.days && animal.days.length > 0;
    const dayCount = hasDays ? animal.days.length : 0;

    // Show success message
    if (hasDays) {
      alert(`Configuration saved. ${dayCount} day${dayCount !== 1 ? 's' : ''} will inherit changes.`);
      // Navigate to workspace devices section
      window.location.hash = `#/workspace?animal=${animalId}&section=devices`;
    } else {
      alert('Configuration saved. Ready to create first recording day.');
      // Navigate to workspace with create-day action
      window.location.hash = `#/workspace?animal=${animalId}&action=create-day`;
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
      ? [...animal.devices.electrode_groups, {
        ...groupData,
        id: generateNextElectrodeGroupId(animal.devices.electrode_groups)
      }]
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
   * Delete electrode group with confirmation
   * @param {object} group - Electrode group to delete
   */
  function handleDeleteGroup(group) {
    // Confirmation dialog
    const message = `Delete electrode group "${group.location}" (${group.device_type})?\n\nThis cannot be undone.`;

    if (!window.confirm(message)) {
      return;
    }

    // Remove from electrode_groups array
    const updatedGroups = animal.devices.electrode_groups.filter(g => g.id !== group.id);

    // Also remove associated channel maps
    const updatedChannelMaps = (animal.devices.ntrode_electrode_group_channel_map || [])
      .filter(map => map.electrode_group_id !== group.id);

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        electrode_groups: updatedGroups,
        ntrode_electrode_group_channel_map: updatedChannelMaps,
      },
    });
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

  /**
   * Handle copy from animal request
   */
  function handleCopyFromAnimal() {
    setCopyDialogOpen(true);
  }

  /**
   * Handle copy from animal execution
   * @param {object} data - Copied electrode groups and channel maps
   */
  function handleCopyConfirm(data) {
    const { sourceAnimalName, electrode_groups, ntrode_electrode_group_channel_map } = data;

    // Append copied data to existing data
    const existingGroups = animal.devices?.electrode_groups || [];
    const existingMaps = animal.devices?.ntrode_electrode_group_channel_map || [];

    const updatedGroups = [...existingGroups, ...electrode_groups];
    const updatedMaps = [...existingMaps, ...ntrode_electrode_group_channel_map];

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        electrode_groups: updatedGroups,
        ntrode_electrode_group_channel_map: updatedMaps,
      },
    });

    setCopyDialogOpen(false);

    // Show success message
    const groupCount = electrode_groups.length;
    alert(`Successfully copied ${groupCount} electrode ${groupCount === 1 ? 'group' : 'groups'} from ${sourceAnimalName}`);
  }

  /**
   * Handle copy from animal cancellation
   */
  function handleCopyCancel() {
    setCopyDialogOpen(false);
  }

  // Channel maps handlers
  /**
   * Open channel map editor for specific electrode group
   * @param {string} groupId - Electrode group ID
   */
  function handleEditChannelMap(groupId) {
    setEditingGroupId(groupId);
    setEditorOpen(true);
  }

  /**
   * Save channel map changes
   * @param {Array} updatedMaps - Updated channel maps for the editing group
   */
  function handleSaveChannelMap(updatedMaps) {
    // Get all channel maps
    const allChannelMaps = animal.devices.ntrode_electrode_group_channel_map || [];

    // Remove old maps for this group and add updated ones
    const otherMaps = allChannelMaps.filter(map => map.electrode_group_id !== editingGroupId);
    const newChannelMaps = [...otherMaps, ...updatedMaps];

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        ntrode_electrode_group_channel_map: newChannelMaps,
      },
    });

    setEditorOpen(false);
    setEditingGroupId(null);
  }

  /**
   * Cancel channel map editor without saving
   */
  function handleCancelChannelMapEditor() {
    setEditorOpen(false);
    setEditingGroupId(null);
  }

  /**
   * Auto-generate all channel maps for all electrode groups
   */
  function handleAutoGenerate() {
    const existing = animal.devices.ntrode_electrode_group_channel_map || [];

    if (existing.length > 0) {
      if (!window.confirm('Overwrite existing channel maps?')) {
        return;
      }
    }

    const generated = generateAllChannelMaps(animal.devices.electrode_groups || []);

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        ntrode_electrode_group_channel_map: generated,
      },
    });
  }

  /**
   * Export channel maps to CSV file
   */
  function handleExportCSV() {
    const channelMaps = animal.devices.ntrode_electrode_group_channel_map || [];
    const electrodeGroups = animal.devices.electrode_groups || [];

    if (channelMaps.length === 0) {
      alert('No channel maps to export. Please auto-generate or configure channel maps first.');
      return;
    }

    downloadChannelMapsCSV(channelMaps, electrodeGroups, `${animalId}_channel_maps.csv`);
  }

  /**
   * Trigger file input for CSV import
   */
  function handleImportCSV() {
    csvFileInputRef.current?.click();
  }

  /**
   * Handle CSV file selection and import
   * @param event
   */
  function handleCSVFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result;
        const importedMaps = importChannelMapsFromCSV(csvContent);

        // Validate imported maps match existing electrode groups
        const electrodeGroupIds = new Set(
          (animal.devices.electrode_groups || []).map((g) => g.id)
        );
        const invalidGroups = importedMaps.filter(
          (map) => !electrodeGroupIds.has(map.electrode_group_id)
        );

        if (invalidGroups.length > 0) {
          const invalidIds = [...new Set(invalidGroups.map((m) => m.electrode_group_id))].join(', ');
          alert(
            `Cannot import CSV:\n\nThe following electrode group IDs in the CSV do not exist:\n${invalidIds}\n\nPlease ensure electrode groups are created before importing channel maps.`
          );
          return;
        }

        // Update animal with imported maps
        actions.updateAnimal(animalId, {
          devices: {
            ...animal.devices,
            ntrode_electrode_group_channel_map: importedMaps,
          },
        });

        alert(`Successfully imported ${importedMaps.length} channel maps from CSV.`);
      } catch (error) {
        alert(`Failed to import CSV:\n\n${error.message}`);
      }

      // Reset file input
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  // Get electrode group for editor
  const editingElectrodeGroup = editingGroupId
    ? animal.devices.electrode_groups.find(g => g.id === editingGroupId)
    : null;

  // Get channel maps for editing group
  const editingChannelMaps = editingGroupId
    ? (animal.devices.ntrode_electrode_group_channel_map || [])
        .filter(map => map.electrode_group_id === editingGroupId)
    : [];

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
          onDelete={handleDeleteGroup}
          onCopy={handleCopyFromAnimal}
        />
      ),
    },
    {
      label: 'Channel Maps',
      component: (
        <div>
          <ChannelMapsStep
            animal={animal}
            onEditChannelMap={handleEditChannelMap}
          />
          <div className="action-buttons" style={{ marginTop: '1rem' }}>
            <button
              onClick={handleAutoGenerate}
              className="action-button btn-primary"
              aria-label="Auto-generate all channel maps"
            >
              Auto-Generate All Channel Maps
            </button>
            <button
              onClick={handleExportCSV}
              className="action-button btn-secondary"
              aria-label="Export channel maps to CSV"
            >
              Export to CSV
            </button>
            <button
              onClick={handleImportCSV}
              className="action-button btn-secondary"
              aria-label="Import channel maps from CSV"
            >
              Import from CSV
            </button>
            <input
              ref={csvFileInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCSVFileSelect}
            />
          </div>
        </div>
      ),
    },
  ];

  // Check if we're on the final step
  const isOnFinalStep = activeStep === steps.length - 1;

  return (
    <div className="animal-editor-stepper">
      <header className="animal-editor-header">
        <h1>Animal Editor: {animal.id}</h1>
      </header>

      {/* Step indicators */}
      <nav className="animal-editor-step-nav" role="navigation" aria-label="Configuration steps">
        <ul className="step-indicators">
          {steps.map((step, index) => (
            <li
              key={index}
              className={`step-indicator ${activeStep === index ? 'active' : ''} ${index < activeStep ? 'completed' : ''}`}
            >
              <button
                className="step-indicator-button"
                onClick={() => setActiveStep(index)}
                aria-label={`Step ${index + 1}: ${step.label}`}
                aria-current={activeStep === index ? 'step' : undefined}
              >
                <span className="step-number">{index + 1}</span>
                <span>{step.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Active step content */}
      <main className="animal-editor-content" id="main-content" tabIndex="-1">
        {steps[activeStep].component}
      </main>

      {/* Navigation buttons */}
      <footer className="animal-editor-footer">
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
      </footer>

      {/* Electrode Groups Modal */}
      <ElectrodeGroupModal
        isOpen={modalOpen}
        mode={modalMode}
        group={editingGroup}
        onSave={handleSaveGroup}
        onCancel={handleCancelModal}
      />

      {/* Channel Map Editor Modal */}
      {editorOpen && editingElectrodeGroup && (
        <dialog open>
          <ChannelMapEditor
            electrodeGroup={editingElectrodeGroup}
            channelMaps={editingChannelMaps}
            onSave={handleSaveChannelMap}
            onCancel={handleCancelChannelMapEditor}
          />
        </dialog>
      )}

      {/* Copy from Animal Dialog */}
      <CopyFromAnimalDialog
        open={copyDialogOpen}
        currentAnimalId={animalId}
        animals={model.workspace.animals}
        onCopy={handleCopyConfirm}
        onCancel={handleCopyCancel}
      />
    </div>
  );
}
