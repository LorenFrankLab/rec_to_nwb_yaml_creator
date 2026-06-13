/**
 * ElectrodeGroupsContainer — the versioned electrode-group section + its wiring.
 *
 * Owns add/edit/delete of electrode groups (including the channel-map AUTO-REGENERATION when a
 * group's device_type changes), copy-from-animal, and the group modals. Hosted by the tabbed
 * Animal View's electrode-groups tab. (Originally extracted from the legacy Animal Editor stepper so
 * both hosts shared one implementation; the stepper was removed in Phase 5.)
 */
import { useState, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import {
  getAnimalDevices,
  getAnimalElectrodeGroups,
  getAnimalNtrodeMaps,
} from '../../../state/workspaceSelectors';
import type { ElectrodeGroup, NtrodeMap } from '../../../state/workspaceTypes';
import { ConfirmDialog } from '../../../components/Modal';
import { generateChannelMapsForGroup, nextNtrodeId } from '../../../utils/channelMapUtils';
import {
  normalizeElectrodeGroupWithDefaults,
  normalizeIdKey,
  normalizeNtrodeMapWithDefaults,
} from '../../../utils/deviceNormalization';
import ElectrodeGroupsStep from '../ElectrodeGroupsStep';
import ElectrodeGroupModal from '../ElectrodeGroupModal';
import type { ElectrodeGroupInput, ElectrodeGroupSaveData } from '../ElectrodeGroupModal';
import CopyFromAnimalDialog from '../CopyFromAnimalDialog';
import type { CopyPayload } from '../CopyFromAnimalDialog';
import { useKnownRegions } from './useKnownRegions';
import { useAnimalAlert } from './useAnimalAlert';
import { useAnimalFieldUpdate } from './useAnimalFieldUpdate';

/**
 * Generate the next sequential electrode group ID (max existing + 1). IDs are integers end-to-end;
 * string-typed legacy ids are parsed defensively.
 */
function generateNextElectrodeGroupId(existingGroups: ElectrodeGroup[]): number {
  if (!existingGroups || existingGroups.length === 0) {
    return 0;
  }
  const maxId = Math.max(
    ...existingGroups.map((g) => {
      const parsed = parseInt(String(g.id), 10);
      return isNaN(parsed) ? 0 : parsed;
    })
  );
  return maxId + 1;
}

interface ElectrodeGroupsContainerProps {
  /** The animal whose electrode groups to edit. */
  animalId: string;
  /** Optional ref the host uses to invoke "add group" from its Alt+N shortcut. */
  addRef?: MutableRefObject<(() => void) | null>;
  /** Called with `true` while the add/edit ElectrodeGroupModal is open and `false` otherwise / on unmount. */
  onPendingEditsChange?: (hasPending: boolean) => void;
}

export default function ElectrodeGroupsContainer({ animalId, addRef, onPendingEditsChange }: ElectrodeGroupsContainerProps) {
  const { model, actions } = useStoreContext();
  const animal = animalId ? model.workspace.animals[animalId] : null;

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [editingGroup, setEditingGroup] = useState<ElectrodeGroup | null>(null);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<ElectrodeGroup | null>(null);

  const knownRegions = useKnownRegions();
  const { showAlert, alertElement } = useAnimalAlert();
  const { handleFieldUpdate } = useAnimalFieldUpdate(animalId);

  // Report "has pending edits" (the add/edit modal being open) to a host that guards navigation.
  // Cleanup resets to false on unmount so a host doesn't hold a stale `true` after the tab is left.
  useEffect(() => {
    onPendingEditsChange?.(modalOpen);
    return () => onPendingEditsChange?.(false);
  }, [modalOpen, onPendingEditsChange]);

  // Register the "add group" handler with the host's Alt+N shortcut ref while mounted. The
  // handler only calls stable setState setters, so a one-time registration is sufficient.
  useEffect(() => {
    if (!addRef) return undefined;
    addRef.current = handleAddGroup;
    return () => {
      addRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addRef]);

  if (!animal) return null;

  const animalDevices = getAnimalDevices(animal);
  const electrodeGroups = getAnimalElectrodeGroups(animal);
  const ntrodeMaps = getAnimalNtrodeMaps(animal);

  /** Open modal in add mode. */
  function handleAddGroup() {
    setModalMode('add');
    setEditingGroup(null);
    setModalOpen(true);
  }

  /** Open modal in edit mode with the selected group (resolved by id, or a passed group object). */
  function handleEditGroup(groupIdOrGroup: number | ElectrodeGroup) {
    setModalMode('edit');
    // Resolve by id (integer or legacy string) via lookup; only treat an actual object as the
    // group itself. A bare integer id must not be mistaken for the group.
    const group = typeof groupIdOrGroup === 'object' && groupIdOrGroup !== null
      ? groupIdOrGroup
      : electrodeGroups.find((g) => normalizeIdKey(g.id) === normalizeIdKey(groupIdOrGroup));
    setEditingGroup(group ?? null);
    setModalOpen(true);
  }

  /**
   * Save electrode group (add or edit). Auto-generates channel maps if device_type changed.
   * Supports bulk creation via the `count` parameter (add mode only).
   */
  function handleSaveGroup(groupData: ElectrodeGroupSaveData) {
    const isAdding = modalMode === 'add';
    const count = groupData.count || 1;

    // Remove count from group data (not part of the electrode group schema).
    const { count: _, ...groupDataWithoutCount } = groupData;

    let updatedGroups: ElectrodeGroup[];
    const groupsToGenerateMapsFor: ElectrodeGroup[] = [];

    if (isAdding) {
      // Add mode: create 'count' identical electrode groups with integer IDs.
      const newGroups: ElectrodeGroup[] = [];
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
      // Edit mode: update single existing group.
      const groupId = editingGroup!.id;
      const normalizedGroup = normalizeElectrodeGroupWithDefaults(
        { ...groupDataWithoutCount, id: groupId },
        groupId
      );
      updatedGroups = electrodeGroups.map((g) =>
        normalizeIdKey(g.id) === normalizeIdKey(editingGroup!.id) ? normalizedGroup : g
      );

      // Check if device_type changed.
      const deviceTypeChanged = editingGroup!.device_type !== normalizedGroup.device_type;
      if (deviceTypeChanged) {
        groupsToGenerateMapsFor.push(normalizedGroup);
      }
    }

    // Auto-generate channel maps for new/changed groups.
    let updatedChannelMaps = ntrodeMaps;

    if (groupsToGenerateMapsFor.length > 0) {
      // Remove old maps for the groups we're regenerating; keep the rest.
      const groupIds = new Set(groupsToGenerateMapsFor.map((g) => normalizeIdKey(g.id)));
      const retainedMaps = updatedChannelMaps.filter(
        (map) => !groupIds.has(normalizeIdKey(map.electrode_group_id))
      );

      // New ntrode IDs start after the current max across the animal, so an incremental add never
      // collides with an existing ntrode.
      let startNtrodeId = nextNtrodeId(retainedMaps);
      const generatedMaps: NtrodeMap[] = [];
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

    // Show success message for bulk creation.
    if (isAdding && count > 1) {
      showAlert(`Successfully created ${count} identical electrode groups`, 'success');
    }
  }

  /** Cancel modal without saving. */
  function handleCancelModal() {
    setModalOpen(false);
  }

  /**
   * Request deletion of an electrode group — opens a confirmation dialog.
   */
  function handleDeleteGroup(group: ElectrodeGroup) {
    setPendingDeleteGroup(group);
  }

  /** Perform the deletion once confirmed, removing the group and its channel maps. */
  function confirmDeleteGroup() {
    const group = pendingDeleteGroup;
    setPendingDeleteGroup(null);
    if (!group) return;

    const deletingGroupId = normalizeIdKey(group.id);
    const updatedGroups = electrodeGroups.filter(
      (g) => normalizeIdKey(g.id) !== deletingGroupId
    );

    const updatedChannelMaps = ntrodeMaps.filter(
      (map) => normalizeIdKey(map.electrode_group_id) !== deletingGroupId
    );

    actions.updateAnimal(animalId, {
      devices: {
        ...animalDevices,
        electrode_groups: updatedGroups,
        ntrode_electrode_group_channel_map: updatedChannelMaps,
      },
    });
  }

  /** Open the copy-from-animal dialog. */
  function handleCopyFromAnimal() {
    setCopyDialogOpen(true);
  }

  /** Append copied electrode groups + channel maps from a source animal. */
  function handleCopyConfirm(data: CopyPayload) {
    const { sourceAnimalName, electrode_groups = [], ntrode_electrode_group_channel_map = [] } = data;

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

    const groupCount = electrode_groups.length;
    showAlert(
      `Successfully copied ${groupCount} electrode ${groupCount === 1 ? 'group' : 'groups'} from ${sourceAnimalName}`,
      'success'
    );
  }

  /** Close the copy-from-animal dialog without copying. */
  function handleCopyCancel() {
    setCopyDialogOpen(false);
  }

  return (
    <>
      <ElectrodeGroupsStep
        animal={animal}
        onFieldUpdate={handleFieldUpdate}
        onAdd={handleAddGroup}
        onEdit={handleEditGroup}
        onDelete={handleDeleteGroup}
        onCopy={handleCopyFromAnimal}
      />

      <ElectrodeGroupModal
        isOpen={modalOpen}
        mode={modalMode}
        group={editingGroup as unknown as ElectrodeGroupInput | null}
        knownRegions={knownRegions}
        onSave={handleSaveGroup}
        onCancel={handleCancelModal}
      />

      <CopyFromAnimalDialog
        open={copyDialogOpen}
        currentAnimalId={animalId}
        animals={model.workspace.animals}
        availableSections={['electrode_groups']}
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

      {alertElement}
    </>
  );
}
