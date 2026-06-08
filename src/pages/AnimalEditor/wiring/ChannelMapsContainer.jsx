/**
 * ChannelMapsContainer — the channel-map view + editor + CSV import/export wiring.
 *
 * Owns opening/saving the per-group {@link ChannelMapEditor} and CSV export/import (with the
 * import-time validation that every imported `electrode_group_id` exists). Hosted by the tabbed
 * Animal View's channel-maps tab. (Originally extracted from the legacy Animal Editor stepper for a
 * shared implementation; the stepper was removed in Phase 5.)
 */
import React, { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../../state/StoreContext';
import {
  getAnimalDevices,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
} from '../../../state/workspaceSelectors';
import { downloadChannelMapsCSV, importChannelMapsFromCSV } from '../../../utils/csvChannelMapUtils';
import { normalizeIdKey, normalizeNtrodeMapWithDefaults } from '../../../utils/deviceNormalization';
import ChannelMapsStep from '../ChannelMapsStep';
import ChannelMapEditor from '../ChannelMapEditor';
import { useAnimalAlert } from './useAnimalAlert';

/**
 * @param {object} props
 * @param {string} props.animalId - The animal whose channel maps to edit.
 * @param {Function} [props.onPendingEditsChange] - Called with `true` while the ChannelMapEditor is
 *   open (an in-progress edit the user could lose) and `false` otherwise / on unmount. The tabbed
 *   AnimalView consults this to guard a section-nav switch (charter decision 2); the temporary
 *   stepper omits it (no nav under it), so the stepper path is byte-unchanged.
 * @returns {JSX.Element|null}
 */
export default function ChannelMapsContainer({ animalId, onPendingEditsChange }) {
  const { model, actions } = useStoreContext();
  const animal = animalId ? model.workspace.animals[animalId] : null;

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const csvFileInputRef = useRef(null);
  const { showAlert, alertElement } = useAnimalAlert();

  // Report "has pending edits" (the editor being open) to a host that guards navigation. Cleanup
  // resets to false on unmount so a host doesn't hold a stale `true` after the tab is left.
  useEffect(() => {
    onPendingEditsChange?.(editorOpen);
    return () => onPendingEditsChange?.(false);
  }, [editorOpen, onPendingEditsChange]);

  if (!animal) return null;

  const animalDevices = getAnimalDevices(animal);
  const electrodeGroups = getAnimalElectrodeGroups(animal);
  const ntrodeMaps = getAnimalNtrodeMaps(animal);

  // Electrode group for the editor. Compare against null, not truthiness — an integer id of 0 is
  // falsy but valid.
  const editingElectrodeGroup = editingGroupId != null
    ? electrodeGroups.find((g) => normalizeIdKey(g.id) === normalizeIdKey(editingGroupId))
    : null;

  const editingChannelMaps = editingGroupId != null
    ? ntrodeMaps.filter((map) => normalizeIdKey(map.electrode_group_id) === normalizeIdKey(editingGroupId))
    : [];

  /**
   * Open channel map editor for a specific electrode group.
   * @param {number} groupId - Integer electrode group ID.
   */
  function handleEditChannelMap(groupId) {
    setEditingGroupId(groupId);
    setEditorOpen(true);
  }

  /**
   * Save channel map changes.
   * @param {Array} updatedMaps - Updated channel maps for the editing group.
   */
  function handleSaveChannelMap(updatedMaps) {
    const allChannelMaps = ntrodeMaps;

    // Remove old maps for this group and add the updated ones.
    const editingKey = normalizeIdKey(editingGroupId);
    const otherMaps = allChannelMaps.filter(
      (map) => normalizeIdKey(map.electrode_group_id) !== editingKey
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

  /** Cancel channel map editor without saving. */
  function handleCancelChannelMapEditor() {
    setEditorOpen(false);
    setEditingGroupId(null);
  }

  /** Export channel maps to a CSV file. */
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

  /** Trigger the file input for CSV import. */
  function handleImportCSV() {
    csvFileInputRef.current?.click();
  }

  /**
   * Handle CSV file selection and import.
   * @param {Event} event - File input change event.
   */
  function handleCSVFileSelect(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvContent = e.target?.result;
        // CSV import fully replaces the channel map (see the store update below), so the imported
        // ntrode ids are renumbered from 0 — no `existingMaps` to avoid colliding with.
        const importedMaps = importChannelMapsFromCSV(csvContent);

        // Validate imported maps match existing electrode groups.
        const electrodeGroupIds = new Set(electrodeGroups.map((g) => normalizeIdKey(g.id)));
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

      // Reset file input.
      event.target.value = '';
    };

    reader.readAsText(file);
  }

  return (
    <div>
      <ChannelMapsStep animal={animal} onEditChannelMap={handleEditChannelMap} />
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

      {editorOpen && editingElectrodeGroup && (
        <ChannelMapEditor
          electrodeGroup={editingElectrodeGroup}
          channelMaps={editingChannelMaps}
          onSave={handleSaveChannelMap}
          onCancel={handleCancelChannelMapEditor}
        />
      )}

      {alertElement}
    </div>
  );
}

ChannelMapsContainer.propTypes = {
  animalId: PropTypes.string.isRequired,
  onPendingEditsChange: PropTypes.func,
};

ChannelMapsContainer.defaultProps = {
  onPendingEditsChange: undefined,
};
