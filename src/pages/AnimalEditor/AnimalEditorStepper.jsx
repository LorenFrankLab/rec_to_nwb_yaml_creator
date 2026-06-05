import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import {
  getAnimalDayIds,
  getAnimalDevices,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
  getConfigHistory,
} from '../../state/workspaceSelectors';
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
import { generateChannelMapsForGroup, nextNtrodeId } from '../../utils/channelMapUtils';
import { downloadChannelMapsCSV, importChannelMapsFromCSV } from '../../utils/csvChannelMapUtils';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeIdKey,
  normalizeNtrodeMapWithDefaults,
} from '../../utils/deviceNormalization';
import { animalEditorStepForFieldPath } from '../DayEditor/validation';
import { applyRepairCommand } from '../../state/repairCommands';
import './AnimalEditorStepper.scss';

/**
 * Generate the next sequential electrode group ID.
 * Finds the max existing ID and increments by 1. IDs are integers end-to-end
 * (schema requires `integer`); string-typed legacy ids are parsed defensively.
 * @param {Array} existingGroups - Current electrode groups
 * @returns {number} Next integer ID (e.g., 0, 1, 2...)
 */
function generateNextElectrodeGroupId(existingGroups) {
  if (!existingGroups || existingGroups.length === 0) {
    return 0;
  }

  const maxId = Math.max(
    ...existingGroups.map(g => {
      const parsed = parseInt(g.id, 10);
      return isNaN(parsed) ? 0 : parsed;
    })
  );

  return maxId + 1;
}

/**
 * Parse a query parameter as a non-negative integer. Blank, signed, decimal, and
 * non-numeric values are treated as absent rather than becoming `0` or `NaN`.
 *
 * @param {string|null} value - Raw query parameter value.
 * @returns {number|null} Parsed integer, or null when absent/invalid.
 */
function parseIntegerParam(value) {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d+$/.test(trimmed)) return null;
  const parsed = Number.parseInt(trimmed, 10);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parse transient Animal Editor route context from the hash query string.
 *
 * @param {string} hash - Current window hash.
 * @returns {{context: string|null, version: number|null, fromDayId: string|null, movedDays: number|null}}
 */
function parseAnimalEditorRouteContext(hash) {
  const query = (hash || '').split('?')[1] || '';
  const params = new URLSearchParams(query);
  const movedDays = parseIntegerParam(params.get('movedDays'));

  return {
    context: params.get('context'),
    version: parseIntegerParam(params.get('version')),
    fromDayId: params.get('fromDay'),
    movedDays: movedDays > 0 ? movedDays : null,
    field: params.get('field'),
  };
}

/**
 * Track route query context while the editor is mounted.
 *
 * @returns {{context: string|null, version: number|null, fromDayId: string|null, movedDays: number|null}}
 */
function useAnimalEditorRouteContext() {
  const [routeContext, setRouteContext] = useState(() => (
    typeof window === 'undefined'
      ? { context: null, version: null, fromDayId: null, movedDays: null, field: null }
      : parseAnimalEditorRouteContext(window.location.hash)
  ));

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const handleHashChange = () => {
      setRouteContext(parseAnimalEditorRouteContext(window.location.hash));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return routeContext;
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
  const routeContext = useAnimalEditorRouteContext();
  const { model, actions } = useStoreContext();
  // Deep-link: a repair routed here as `?field=<path>` opens the Animal Editor on the
  // step that owns that field (channel maps / electrode groups / hardware) instead of
  // dropping the target and landing on step 0. Read at mount via the initializer.
  const [activeStep, setActiveStep] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const initial = parseAnimalEditorRouteContext(window.location.hash);
    return initial.field ? animalEditorStepForFieldPath(initial.field).index : 0;
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [editingGroup, setEditingGroup] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
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
  const csvFileInputRef = useRef(null);
  // In-app feedback replacing native alert()/confirm().
  const [alertState, setAlertState] = useState({ isOpen: false, message: '', type: 'info', title: 'Alert', onClose: null });
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState(null);

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

  // Canonical region list seeded from regions already used across the workspace,
  // so the electrode-group modal can offer them and snap case-only variants.
  // Memoized (and declared before the early returns, per the Rules of Hooks) so a
  // fresh array reference doesn't defeat the modal's BrainRegionAutocomplete memo.
  // Renders on every workspace; a persisted `electrode_groups` may be a non-array, and
  // `|| []` would PRESERVE it and throw on the `.flatMap`. Read through the canonical
  // selector so a single corrupt animal can't crash this region-collection sweep.
  const knownRegions = useMemo(() => [
    ...new Set(
      Object.values(model.workspace.animals || {})
        .flatMap((a) => getAnimalElectrodeGroups(a))
        .flatMap((g) => [g.location, g.targeted_location])
        .filter((r) => typeof r === 'string' && r.trim() !== '')
    ),
  ], [model.workspace.animals]);

  // Validate animal exists
  const animal = animalId ? model.workspace.animals[animalId] : null;

  if (!animalId) {
    return <AnimalEditorError message="No animal specified in URL." />;
  }

  if (!animal) {
    return <AnimalEditorError message={`Animal "${animalId}" not found.`} />;
  }

  const animalDevices = getAnimalDevices(animal);
  const electrodeGroups = getAnimalElectrodeGroups(animal);
  const ntrodeMaps = getAnimalNtrodeMaps(animal);

  // The editor is a repair destination for malformed persisted state, so it must not
  // crash on the corruption it exists to fix. Read history through the canonical selector:
  // a non-array `configurationHistory` degrades to no history instead of throwing.
  const configurationHistory = getConfigHistory(animal);
  const latestSnapshot = configurationHistory[configurationHistory.length - 1] || null;
  const latestConfigurationVersion = latestSnapshot?.version ?? null;
  const isReconfigurationEdit = routeContext.context === 'reconfigure';
  const routeVersionExists = routeContext.version != null &&
    configurationHistory.some((snapshot) => snapshot.version === routeContext.version);
  const contextVersion = routeVersionExists ? routeContext.version : latestConfigurationVersion;
  const contextIsLatest = contextVersion != null && contextVersion === latestConfigurationVersion;
  const sourceDay = routeContext.fromDayId ? model.workspace.days?.[routeContext.fromDayId] : null;
  const sourceContextText = sourceDay
    ? ` for reconfiguration starting ${sourceDay.date}.`
    : ' after reconfiguration fork.';
  const movedDaysText = routeContext.movedDays != null
    ? ` Moved ${routeContext.movedDays} ${routeContext.movedDays === 1 ? 'day' : 'days'} to this version.`
    : '';

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
   * @param {number|string|object} groupIdOrGroup - Electrode group ID (integer) or full group object
   */
  function handleEditGroup(groupIdOrGroup) {
    setModalMode('edit');
    // Resolve by id (integer or legacy string) via lookup; only treat an actual
    // object as the group itself. A bare integer id must not be mistaken for the group.
    const group = typeof groupIdOrGroup === 'object' && groupIdOrGroup !== null
      ? groupIdOrGroup
      : electrodeGroups.find(
          (g) => normalizeIdKey(g.id) === normalizeIdKey(groupIdOrGroup)
        );
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
      // Add mode: create 'count' identical electrode groups with integer IDs
      const newGroups = [];
      const startId = generateNextElectrodeGroupId(electrodeGroups);

      for (let i = 0; i < count; i++) {
        const groupId = startId + i;
        const newGroup = normalizeElectrodeGroupWithDefaults(
          { ...groupDataWithoutCount, id: groupId },
          groupId
        );
        newGroups.push(newGroup);
        groupsToGenerateMapsFor.push(newGroup);
      }

      updatedGroups = [...electrodeGroups, ...newGroups];
    } else {
      // Edit mode: update single existing group
      const groupId = editingGroup.id;
      const normalizedGroup = normalizeElectrodeGroupWithDefaults(
        { ...groupDataWithoutCount, id: groupId },
        groupId
      );
      updatedGroups = electrodeGroups.map(g =>
        normalizeIdKey(g.id) === normalizeIdKey(editingGroup.id) ? normalizedGroup : g
      );

      // Check if device_type changed
      const deviceTypeChanged = editingGroup.device_type !== normalizedGroup.device_type;
      if (deviceTypeChanged) {
        groupsToGenerateMapsFor.push(normalizedGroup);
      }
    }

    // Auto-generate channel maps for new/changed groups
    let updatedChannelMaps = ntrodeMaps;

    if (groupsToGenerateMapsFor.length > 0) {
      // Remove old maps for the groups we're regenerating; keep the rest.
      const groupIds = new Set(groupsToGenerateMapsFor.map(g => normalizeIdKey(g.id)));
      const retainedMaps = updatedChannelMaps.filter(
        map => !groupIds.has(normalizeIdKey(map.electrode_group_id))
      );

      // New ntrode IDs start after the current max across the animal, so an
      // incremental add never collides with an existing ntrode.
      let startNtrodeId = nextNtrodeId(retainedMaps);
      const generatedMaps = [];
      for (const group of groupsToGenerateMapsFor) {
        const groupMaps = generateChannelMapsForGroup(group, startNtrodeId);
        generatedMaps.push(...groupMaps);
        startNtrodeId += groupMaps.length;
      }

      updatedChannelMaps = retainedMaps.concat(generatedMaps);
    }

    actions.updateAnimal(animalId, {
      devices: {
        ...animalDevices,
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
    const deletingGroupId = normalizeIdKey(group.id);
    const updatedGroups = electrodeGroups.filter(
      g => normalizeIdKey(g.id) !== deletingGroupId
    );

    // Also remove associated channel maps
    const updatedChannelMaps = ntrodeMaps
      .filter(map => normalizeIdKey(map.electrode_group_id) !== deletingGroupId);

    actions.updateAnimal(animalId, {
      devices: {
        ...animalDevices,
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
   * Execute a raw-shape corruption's repair command in place (the destination-side half of
   * the corruption contract). The animal-owned commands (resetAnimalCameras /
   * resetDataAcqDevice / rebuildConfigurationHistory) need only `actions` + `animalId` +
   * `animal`, which this editor owns. Routed to the RawCorruptionBanner in HardwareConfigStep.
   *
   * @param {object} issue - A raw-shape issue carrying a `repairCommand`.
   */
  function handleRepair(issue) {
    if (!issue?.repairCommand) return;
    applyRepairCommand(issue.repairCommand, { actions, animalId, animal });
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
    const existingGroups = electrodeGroups;
    const existingMaps = ntrodeMaps;

    const updatedGroups = [...existingGroups, ...electrode_groups]
      .map((group, index) => normalizeElectrodeGroupWithDefaults(group, index));
    const updatedMaps = [...existingMaps, ...ntrode_electrode_group_channel_map]
      .map((map, index) => normalizeNtrodeMapWithDefaults(map, index));

    actions.updateAnimal(animalId, {
      devices: {
        ...animalDevices,
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
   * @param {number} groupId - Integer electrode group ID
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
    const allChannelMaps = ntrodeMaps;

    // Remove old maps for this group and add updated ones
    const editingKey = normalizeIdKey(editingGroupId);
    const otherMaps = allChannelMaps.filter(
      map => normalizeIdKey(map.electrode_group_id) !== editingKey
    );
    const newChannelMaps = [...otherMaps, ...updatedMaps]
      .map((map, index) => normalizeNtrodeMapWithDefaults(map, index));

    actions.updateAnimal(animalId, {
      devices: {
        ...animalDevices,
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
    const channelMaps = ntrodeMaps;

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
   * @param {Event} event - File input change event.
   */
  function handleCSVFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result;
        // CSV import fully replaces the channel map (see the store update below), so
        // the imported ntrode ids are renumbered from 0 — no `existingMaps` to avoid
        // colliding with. The collision-safe `existingMaps` parameter exists for an
        // additive caller, which this is not.
        const importedMaps = importChannelMapsFromCSV(csvContent);

        // Validate imported maps match existing electrode groups
        const electrodeGroupIds = new Set(
          electrodeGroups.map((g) => normalizeIdKey(g.id))
        );
        const invalidGroups = importedMaps.filter(
          (map) => !electrodeGroupIds.has(normalizeIdKey(map.electrode_group_id))
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
            ...animalDevices,
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

  // Get electrode group for editor. Compare against null, not truthiness — an
  // integer group id of 0 is falsy but valid.
  const editingElectrodeGroup = editingGroupId != null
    ? electrodeGroups.find(
        g => normalizeIdKey(g.id) === normalizeIdKey(editingGroupId)
      )
    : null;

  // Get channel maps for editing group
  const editingChannelMaps = editingGroupId != null
    ? ntrodeMaps
        .filter(map => normalizeIdKey(map.electrode_group_id) === normalizeIdKey(editingGroupId))
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
          onRepair={handleRepair}
        />
      ),
    },
  ];

  // Check if we're on the final step
  const isOnFinalStep = activeStep === steps.length - 1;
  // Keep the shortcut handler's step count + add target current (the ref + hook are
  // declared up top, before the early returns, to satisfy the Rules of Hooks). Alt+N
  // adds an electrode group on the Electrode Groups step (0); other steps have no add.
  stepCountRef.current = steps.length;
  addHandlerRef.current = activeStep === 0 ? handleAddGroup : null;

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
          <h1>Animal Editor: {animal.id}</h1>
          {isReconfigurationEdit && (
            <div
              className={`configuration-edit-context ${contextIsLatest ? '' : 'configuration-edit-context-warning'}`}
              role="status"
            >
              {contextIsLatest
                ? `Editing latest configuration v${contextVersion}`
                : `Review configuration v${contextVersion ?? 'unknown'}; current latest is v${latestConfigurationVersion ?? 'unknown'}`}
              {sourceContextText}
              {movedDaysText}
            </div>
          )}
        </div>
      </div>

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

      {/* Electrode Groups Modal */}
      <ElectrodeGroupModal
        isOpen={modalOpen}
        mode={modalMode}
        group={editingGroup}
        knownRegions={knownRegions}
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
