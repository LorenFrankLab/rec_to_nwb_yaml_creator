import { useState, useMemo, useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../../components/Modal/Modal';
import { getAnimalElectrodeGroups, getAnimalNtrodeMaps } from '../../state/workspaceSelectors';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeIdKey,
  normalizeNtrodeMapWithDefaults,
} from '../../utils/deviceNormalization';
import './CopyFromAnimalDialog.scss';

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
  const titleId = useId();

  /**
   * Get available source animals (exclude current)
   */
  const availableAnimals = useMemo(() => {
    return Object.entries(animals || {})
      .filter(([animalId]) => animalId !== currentAnimalId)
      .map(([animalId, animalData]) => ({
        id: animalId,
        name: animalData.subject?.subject_id || animalId,
        electrodeGroups: getAnimalElectrodeGroups(animalData),
        channelMaps: getAnimalNtrodeMaps(animalData),
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
    const currentGroups = getAnimalElectrodeGroups(currentAnimal);
    const currentMaps = getAnimalNtrodeMaps(currentAnimal);

    const maxGroupId = currentGroups.length > 0
      ? Math.max(...currentGroups.map((g) => {
          const parsed = parseInt(g.id, 10);
          return Number.isNaN(parsed) ? -1 : parsed;
        }))
      : -1;

    const maxNtrodeId = currentMaps.length > 0
      ? Math.max(...currentMaps.map((m) => {
          const parsed = parseInt(m.ntrode_id, 10);
          return Number.isNaN(parsed) ? -1 : parsed;
        }))
      : -1;

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

    // Deep clone electrode groups with new integer IDs
    const copiedGroups = selectedAnimal.electrodeGroups.map((group, index) => {
      const oldId = normalizeIdKey(group.id);
      const newId = nextIds.nextGroupId + index;
      groupIdMap.set(oldId, newId);

      return normalizeElectrodeGroupWithDefaults({ ...group, id: newId }, newId);
    });

    // Deep clone channel maps with new integer IDs and updated electrode_group_id references
    let nextNtrodeId = nextIds.nextNtrodeId;
    const copiedMaps = selectedAnimal.channelMaps.flatMap((map) => {
      const oldGroupId = normalizeIdKey(map.electrode_group_id);
      if (!groupIdMap.has(oldGroupId)) {
        return [];
      }

      const copied = normalizeNtrodeMapWithDefaults(
        {
          ...map,
          ntrode_id: nextNtrodeId,
          electrode_group_id: groupIdMap.get(oldGroupId),
        },
        nextNtrodeId,
        groupIdMap.get(oldGroupId)
      );
      nextNtrodeId += 1;
      return [copied];
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

  return (
    <Modal
      isOpen={open}
      onClose={handleCancel}
      title="Copy Electrode Groups from Animal"
      titleId={titleId}
      className="copy-from-animal-modal"
    >
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
    </Modal>
  );
}

CopyFromAnimalDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  currentAnimalId: PropTypes.string.isRequired,
  animals: PropTypes.object.isRequired,
  onCopy: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
