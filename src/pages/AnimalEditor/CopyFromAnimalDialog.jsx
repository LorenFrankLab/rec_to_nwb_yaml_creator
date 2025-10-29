import { useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import './ElectrodeGroupModal.scss';

/**
 * Dialog for copying electrode groups from another animal
 *
 * Allows users to select an animal from the workspace and copy all its
 * electrode groups and channel maps with automatically generated new IDs.
 *
 * @param {object} props
 * @param {boolean} props.open - Whether dialog is open
 * @param {string} props.currentAnimalId - ID of current animal (excluded from list)
 * @param {object} props.animals - All animals from workspace
 * @param {Function} props.onCopy - Callback when copy confirmed
 * @param {Function} props.onCancel - Callback when canceled
 * @returns {JSX.Element}
 */
export default function CopyFromAnimalDialog({ open, currentAnimalId, animals, onCopy, onCancel }) {
  const [selectedAnimalId, setSelectedAnimalId] = useState(null);

  /**
   * Get available source animals (exclude current)
   */
  const availableAnimals = useMemo(() => {
    return Object.entries(animals || {})
      .filter(([animalId]) => animalId !== currentAnimalId)
      .map(([animalId, animalData]) => ({
        id: animalId,
        name: animalData.subject?.subject_id || animalId,
        electrodeGroups: animalData.devices?.electrode_groups || [],
        channelMaps: animalData.devices?.ntrode_electrode_group_channel_map || [],
      }));
  }, [animals, currentAnimalId]);

  /**
   * Get current animal data
   */
  const currentAnimal = useMemo(() => {
    return animals?.[currentAnimalId] || null;
  }, [animals, currentAnimalId]);

  /**
   * Get selected source animal
   */
  const selectedAnimal = useMemo(() => {
    if (!selectedAnimalId) return null;
    return availableAnimals.find(a => a.id === selectedAnimalId);
  }, [availableAnimals, selectedAnimalId]);

  /**
   * Calculate next available IDs for electrode groups and channel maps
   */
  const nextIds = useMemo(() => {
    const currentGroups = currentAnimal?.devices?.electrode_groups || [];
    const currentMaps = currentAnimal?.devices?.ntrode_electrode_group_channel_map || [];

    const maxGroupId = currentGroups.length > 0
      ? Math.max(...currentGroups.map(g => parseInt(g.id, 10) || 0))
      : 0;

    const maxNtrodeId = currentMaps.length > 0
      ? Math.max(...currentMaps.map(m => parseInt(m.ntrode_id, 10) || 0))
      : 0;

    return {
      nextGroupId: maxGroupId + 1,
      nextNtrodeId: maxNtrodeId + 1,
    };
  }, [currentAnimal]);

  /**
   * Handle copy button click
   */
  function handleCopy() {
    if (!selectedAnimal || selectedAnimal.electrodeGroups.length === 0) {
      return;
    }

    // Create mapping of old electrode_group IDs to new IDs
    const groupIdMap = new Map();

    // Deep clone electrode groups with new IDs
    const copiedGroups = selectedAnimal.electrodeGroups.map((group, index) => {
      const oldId = group.id;
      const newId = (nextIds.nextGroupId + index).toString();
      groupIdMap.set(oldId, newId);

      return {
        ...structuredClone(group),
        id: newId,
      };
    });

    // Deep clone channel maps with new IDs and updated electrode_group_id references
    const copiedMaps = selectedAnimal.channelMaps.map((map, index) => {
      const oldGroupId = map.electrode_group_id;
      const newGroupId = groupIdMap.get(oldGroupId) || oldGroupId;

      return {
        ...structuredClone(map),
        ntrode_id: String(nextIds.nextNtrodeId + index),
        electrode_group_id: newGroupId,
      };
    });

    onCopy({
      sourceAnimalName: selectedAnimal.name,
      electrode_groups: copiedGroups,
      ntrode_electrode_group_channel_map: copiedMaps,
    });

    // Reset selection
    setSelectedAnimalId(null);
  }

  /**
   * Handle cancel button click
   */
  function handleCancel() {
    setSelectedAnimalId(null);
    onCancel();
  }

  /**
   * Determine if copy button should be enabled
   */
  const canCopy = selectedAnimal && selectedAnimal.electrodeGroups.length > 0;

  /**
   * Count of groups that will be copied
   */
  const groupCount = selectedAnimal?.electrodeGroups.length || 0;

  if (!open) {
    return null;
  }

  return (
    <dialog open className="electrode-group-modal">
      <div className="modal-content">
        <header className="modal-header">
          <h2>Copy Electrode Groups from Animal</h2>
        </header>

        <div className="modal-body">
          {availableAnimals.length === 0 ? (
            <p className="info-message">
              No other animals available to copy from.
            </p>
          ) : (
            <>
              <p className="info-message">
                Select an animal to copy electrode groups from. All electrode groups and their channel mappings will be copied with new IDs.
              </p>

              <div className="animal-list">
                {availableAnimals.map((animal) => {
                  const groupCount = animal.electrodeGroups.length;
                  const hasGroups = groupCount > 0;
                  const groupText = groupCount === 1
                    ? '1 electrode group'
                    : `${groupCount} electrode groups`;

                  return (
                    <label
                      key={animal.id}
                      className={`animal-option ${!hasGroups ? 'disabled' : ''}`}
                    >
                      <input
                        type="radio"
                        name="sourceAnimal"
                        value={animal.id}
                        checked={selectedAnimalId === animal.id}
                        disabled={!hasGroups}
                        onChange={(e) => setSelectedAnimalId(e.target.value)}
                        aria-label={`${animal.name} (${groupText})`}
                      />
                      <div className="animal-info">
                        <span className="animal-name">{animal.name}</span>
                        <span className="animal-group-count">{groupText}</span>
                      </div>
                    </label>
                  );
                })}
              </div>

              {selectedAnimal && groupCount > 0 && (
                <div className="copy-preview">
                  <p>
                    {groupCount} electrode {groupCount === 1 ? 'group' : 'groups'} will be copied
                    from <strong>{selectedAnimal.name}</strong> with new IDs starting from {nextIds.nextGroupId}.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <footer className="modal-actions">
          <button
            type="button"
            onClick={handleCancel}
            className="button-secondary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!canCopy}
            className="button-primary"
          >
            Copy
          </button>
        </footer>
      </div>
    </dialog>
  );
}

CopyFromAnimalDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  currentAnimalId: PropTypes.string.isRequired,
  animals: PropTypes.object.isRequired,
  onCopy: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
