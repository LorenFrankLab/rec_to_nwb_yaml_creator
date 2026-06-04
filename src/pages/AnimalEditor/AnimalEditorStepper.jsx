import { useState, useRef, useCallback } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { useStepperShortcut } from '../../hooks/stepperShortcuts';
import { useAnimalIdFromUrl } from '../../hooks/useAnimalIdFromUrl';
import ElectrodeGroupsStep from './ElectrodeGroupsStep';
import ElectrodeGroupModal from './ElectrodeGroupModal';
import CopyFromAnimalDialog from './CopyFromAnimalDialog';
import ChannelMapsStep from './ChannelMapsStep';
import ChannelMapEditor from './ChannelMapEditor';
import HardwareConfigStep from './HardwareConfigStep';
import AlertModal from '../../components/AlertModal';
import { ConfirmDialog } from '../../components/Modal';
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
 * Manages the 3-step workflow for animal-level configuration:
 * 1. Electrode Groups - Configure device types, locations, coordinates
 * 2. Channel Maps - Configure logical-to-hardware channel mappings
 * 3. Hardware Config - Configure cameras, data acquisition device, behavioral events
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
  // In-app feedback replacing native alert()/confirm().
  const [alertState, setAlertState] = useState({ isOpen: false, message: '', type: 'info', title: 'Alert', onClose: null });
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null);

  // Global Alt+Arrow shortcuts advance/retreat the stepper. Declared before the
  // early returns below to satisfy the Rules of Hooks; the step count is filled in
  // once `steps` is built further down (stepCountRef.current = steps.length).
  const stepCountRef = useRef(1);
  useStepperShortcut(
    useCallback((action) => {
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

    const hasDays = animal.days && animal.days.length > 0;
    const dayCount = hasDays ? animal.days.length : 0;

    // Show success message, then navigate once the user dismisses it.
    if (hasDays) {
      showAlert(
        `Configuration saved. ${dayCount} day${dayCount !== 1 ? 's' : ''} will inherit changes. Close to return to the workspace.`,
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
   * @param {string|object} groupIdOrGroup - Electrode group ID or full group object
   */
  function handleEditGroup(groupIdOrGroup) {
    setModalMode('edit');
    // Handle both cases: groupId (string) or full group object
    const group = typeof groupIdOrGroup === 'string'
      ? animal.devices.electrode_groups.find(g => g.id === groupIdOrGroup)
      : groupIdOrGroup;
    setEditingGroup(group);
    setModalOpen(true);
  }

  /**
   * Save electrode group (add or edit)
   * Auto-generates channel maps if device_type changed (like old app)
   * Supports bulk creation via count parameter (add mode only)
   * @param {object} groupData - Form data from modal (includes count for add mode)
   */
  function handleSaveGroup(groupData) {
    const isAdding = modalMode === 'add';
    const count = groupData.count || 1;

    // Remove count from group data (not part of electrode group schema)
    const { count: _, ...groupDataWithoutCount } = groupData;

    let updatedGroups;
    let groupsToGenerateMapsFor = [];

    if (isAdding) {
      // Add mode: create 'count' identical electrode groups
      const newGroups = [];
      const startId = parseInt(generateNextElectrodeGroupId(animal.devices.electrode_groups), 10);

      for (let i = 0; i < count; i++) {
        const groupId = String(startId + i);
        const newGroup = { ...groupDataWithoutCount, id: groupId };
        newGroups.push(newGroup);
        groupsToGenerateMapsFor.push(newGroup);
      }

      updatedGroups = [...animal.devices.electrode_groups, ...newGroups];
    } else {
      // Edit mode: update single existing group
      const groupId = editingGroup.id;
      updatedGroups = animal.devices.electrode_groups.map(g =>
        g.id === editingGroup.id ? { ...g, ...groupDataWithoutCount } : g
      );

      // Check if device_type changed
      const deviceTypeChanged = editingGroup.device_type !== groupDataWithoutCount.device_type;
      if (deviceTypeChanged) {
        groupsToGenerateMapsFor.push({ ...groupDataWithoutCount, id: groupId });
      }
    }

    // Auto-generate channel maps for new/changed groups
    let updatedChannelMaps = animal.devices.ntrode_electrode_group_channel_map || [];

    if (groupsToGenerateMapsFor.length > 0) {
      // Generate maps for all new/changed groups
      const generatedMaps = generateAllChannelMaps(groupsToGenerateMapsFor);

      // Remove old maps for these groups and add new generated ones
      const groupIds = new Set(groupsToGenerateMapsFor.map(g => g.id));
      updatedChannelMaps = updatedChannelMaps
        .filter(map => !groupIds.has(map.electrode_group_id))
        .concat(generatedMaps);
    }

    actions.updateAnimal(animalId, {
      devices: {
        ...animal.devices,
        electrode_groups: updatedGroups,
        ntrode_electrode_group_channel_map: updatedChannelMaps,
      },
    });

    setModalOpen(false);

    // Show success message for bulk creation
    if (isAdding && count > 1) {
      showAlert(`Successfully created ${count} identical electrode groups`, 'success');
    }
  }

  /**
   * Cancel modal without saving
   */
  function handleCancelModal() {
    setModalOpen(false);
  }

  /**
   * Request deletion of an electrode group — opens a confirmation dialog.
   * @param {object} group - Electrode group to delete
   */
  function handleDeleteGroup(group) {
    setPendingDeleteGroup(group);
  }

  /**
   * Perform the deletion once confirmed, removing the group and its channel maps.
   */
  function confirmDeleteGroup() {
    const group = pendingDeleteGroup;
    setPendingDeleteGroup(null);
    if (!group) return;

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
    showAlert(
      `Successfully copied ${groupCount} electrode ${groupCount === 1 ? 'group' : 'groups'} from ${sourceAnimalName}`,
      'success'
    );
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
   * Export channel maps to CSV file
   */
  function handleExportCSV() {
    const channelMaps = animal.devices.ntrode_electrode_group_channel_map || [];
    const electrodeGroups = animal.devices.electrode_groups || [];

    if (channelMaps.length === 0) {
      showAlert(
        'No channel maps to export. Channel maps are automatically created when you add electrode groups with device types.',
        'info'
      );
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
          showAlert(
            `Cannot import CSV. The following electrode group IDs in the CSV do not exist: ${invalidIds}. Please ensure electrode groups are created before importing channel maps.`,
            'error'
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

        showAlert(`Successfully imported ${importedMaps.length} channel maps from CSV.`, 'success');
      } catch (error) {
        showAlert(`Failed to import CSV: ${error.message}`, 'error');
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
            <p className="help-text" style={{ marginBottom: '0.5rem', color: '#666' }}>
              Channel maps are automatically generated when you select a device type for an electrode group.
              Use the buttons below to export or import channel maps as CSV.
            </p>
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
    {
      label: 'Hardware Config',
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
  // Keep the shortcut handler's step count current (the ref + hook are declared up
  // top, before the early returns, to satisfy the Rules of Hooks).
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
        <h1>Animal Editor: {animal.id}</h1>
      </div>

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
      <div className="visually-hidden" role="status" aria-live="polite">
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
        <ChannelMapEditor
          electrodeGroup={editingElectrodeGroup}
          channelMaps={editingChannelMaps}
          onSave={handleSaveChannelMap}
          onCancel={handleCancelChannelMapEditor}
        />
      )}

      {/* Copy from Animal Dialog */}
      <CopyFromAnimalDialog
        open={copyDialogOpen}
        currentAnimalId={animalId}
        animals={model.workspace.animals}
        onCopy={handleCopyConfirm}
        onCancel={handleCopyCancel}
      />

      <ConfirmDialog
        isOpen={!!pendingDeleteGroup}
        title="Delete electrode group?"
        message={
          pendingDeleteGroup
            ? `Delete electrode group "${pendingDeleteGroup.location}" (${pendingDeleteGroup.device_type})? This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        destructive
        onConfirm={confirmDeleteGroup}
        onCancel={() => setPendingDeleteGroup(null)}
      />

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
