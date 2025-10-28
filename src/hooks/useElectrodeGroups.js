import { useCallback } from 'react';
import { deviceTypeMap, getShankCount } from '../ntrode/deviceTypes';
import { arrayDefaultValues } from '../valueList';

/**
 * Custom hook for managing electrode group operations including ntrode channel map synchronization
 *
 * @param {object} formData - The current form state
 * @param {Function} setFormData - Function to update form state
 * @returns {object} Electrode group management functions
 *
 * @example
 * const { nTrodeMapSelected, removeElectrodeGroupItem, duplicateElectrodeGroupItem } =
 *   useElectrodeGroups(formData, setFormData);
 *
 * // Handle device type selection
 * <select onChange={(e) => nTrodeMapSelected(e, { key: 'electrode_groups', index: 0 })} />
 *
 * // Remove electrode group
 * <button onClick={() => removeElectrodeGroupItem(0, 'electrode_groups')}>Remove</button>
 *
 * // Duplicate electrode group
 * <button onClick={() => duplicateElectrodeGroupItem(0, 'electrode_groups')}>Duplicate</button>
 */
export function useElectrodeGroups(formData, setFormData) {
  /**
   * Auto-generates ntrode channel maps when device type is selected for an electrode group
   *
   * This function:
   * 1. Sets the device_type on the electrode group
   * 2. Generates ntrode objects (one per shank) with channel mappings
   * 3. Removes old ntrode maps for this electrode group
   * 4. Adds new ntrode maps to formData
   * 5. Renumbers all ntrode_id values sequentially (1, 2, 3, ...)
   *
   * @param {Event} e - The select change event
   * @param {object} metaData - Metadata about which electrode group was modified
   * @param {string} metaData.key - The form key ('electrode_groups')
   * @param {number} metaData.index - The index of the electrode group in the array
   * @returns {null} Always returns null
   *
   * @example
   * // Device type selection handler
   * <select
   *   value={formData.electrode_groups[0].device_type}
   *   onChange={(e) => nTrodeMapSelected(e, { key: 'electrode_groups', index: 0 })}
   * >
   *   <option value="tetrode_12.5">Tetrode</option>
   *   <option value="32c-2s8mm6cm-20um-40um-dl">32-channel 2-shank</option>
   * </select>
   */
  const nTrodeMapSelected = useCallback(
    (e, metaData) => {
      const form = structuredClone(formData);
      const { value } = e.target;
      const { key, index } = metaData;
      const electrodeGroupId = form.electrode_groups[index].id;
      const deviceTypeValues = deviceTypeMap(value);
      const shankCount = getShankCount(value);
      const map = {};

      form[key][index].device_type = value;

      // set map with default values
      deviceTypeValues.forEach((deviceTypeValue) => {
        map[deviceTypeValue] = deviceTypeValue;
      });

      const nTrodes = [];

      // set nTrodes data except for bad_channel as the default suffices for now
      for (let nIndex = 0; nIndex < shankCount; nIndex += 1) {
        const nTrodeBase = structuredClone(
          arrayDefaultValues.ntrode_electrode_group_channel_map
        );

        const nTrodeMap = { ...map };
        const nTrodeMapKeys = Object.keys(nTrodeMap).map((k) => parseInt(k, 10));
        const nTrodeMapLength = nTrodeMapKeys.length;

        nTrodeMapKeys.forEach((nKey) => {
          nTrodeMap[nKey] += nTrodeMapLength * nIndex;
        });

        nTrodeBase.electrode_group_id = electrodeGroupId;
        nTrodeBase.map = nTrodeMap;

        nTrodes.push(nTrodeBase);
      }

      const nTrodeMapFormData = form?.ntrode_electrode_group_channel_map?.filter(
        (n) => n.electrode_group_id !== electrodeGroupId
      );

      form.ntrode_electrode_group_channel_map = structuredClone(nTrodeMapFormData);

      nTrodes.forEach((n) => {
        form?.ntrode_electrode_group_channel_map?.push(n);
      });

      // ntrode_id should be in increments of 1 starting at 1. This code resets
      // ntrode_id if necessary to ensure this this.
      //
      // sorted by electrode_group so the UI is sorted by electrode_group and ntrode is displayed under electrode_group
      form?.ntrode_electrode_group_channel_map
        // ?.sort((a, b) => (a.electrode_group_id > b.electrode_group_id ? 1 : -1))
        ?.forEach((n, nIndex) => {
          n.ntrode_id = nIndex + 1;
        });

      setFormData(form);

      return null;
    },
    [formData, setFormData]
  );

  /**
   * Removes an electrode group and all its associated ntrode channel maps
   *
   * This function:
   * 1. Shows a confirmation dialog
   * 2. Removes the electrode group from the array
   * 3. Removes all ntrode maps with matching electrode_group_id
   * 4. Updates formData state
   *
   * @param {number} index - The index of the electrode group to remove
   * @param {string} key - The form key ('electrode_groups')
   * @returns {null} Returns null (guard clause or no action)
   *
   * @example
   * // Remove button handler
   * <button onClick={() => removeElectrodeGroupItem(0, 'electrode_groups')}>
   *   Remove
   * </button>
   */
  const removeElectrodeGroupItem = useCallback(
    (index, key) => {
      // eslint-disable-next-line no-alert
      if (window.confirm(`Remove index ${index} from ${key}?`)) {
        const form = structuredClone(formData);
        const items = structuredClone(form[key]);

        if (!items || items.length === 0) {
          return null;
        }

        const item = structuredClone(items[index]);

        if (!item) {
          return null;
        }

        // remove ntrode related to electrode_groups
        form.ntrode_electrode_group_channel_map =
          form.ntrode_electrode_group_channel_map.filter(
            (nTrode) => nTrode.electrode_group_id !== item.id
          );

        // remove electrode_groups item
        items.splice(index, 1);
        form[key] = items;
        setFormData(form);
      }
      return null;
    },
    [formData, setFormData]
  );

  /**
   * Duplicates an electrode group and all its associated ntrode channel maps
   *
   * This function:
   * 1. Clones the electrode group with a new ID (max ID + 1)
   * 2. Finds all associated ntrode maps by electrode_group_id
   * 3. Duplicates ntrode maps with incremented ntrode_ids
   * 4. Updates electrode_group_id on duplicated ntrodes
   * 5. Inserts cloned electrode group immediately after the original
   * 6. Updates formData state
   *
   * Guard clauses:
   * - Returns early if !electrodeGroups || !electrodeGroup || !clonedElectrodeGroup
   *
   * @param {number} index - The index of the electrode group to duplicate
   * @param {string} key - The form key ('electrode_groups')
   * @returns {void}
   *
   * @example
   * // Duplicate button handler
   * <button onClick={() => duplicateElectrodeGroupItem(0, 'electrode_groups')}>
   *   Duplicate
   * </button>
   */
  const duplicateElectrodeGroupItem = useCallback(
    (index, key) => {
      const form = structuredClone(formData);
      const electrodeGroups = form.electrode_groups;

      // Check electrodeGroups first before accessing form[key][index]
      if (!electrodeGroups) {
        return;
      }

      const electrodeGroup = form[key][index];
      const clonedElectrodeGroup = structuredClone(electrodeGroup);

      // do not proceed if something is wrong with electrode group.
      // You cannot clone a falsey object
      if (!electrodeGroup || !clonedElectrodeGroup) {
        return;
      }

      // get the new electrode's id
      const clonedElectrodeGroupId = Math.max(...electrodeGroups.map((f) => f.id)) + 1;

      // id has to be set anew to avoid collision
      clonedElectrodeGroup.id = clonedElectrodeGroupId;

      const ntrodeElectrodeGroupChannelMap = form.ntrode_electrode_group_channel_map;

      // get ntrode_electrode_group_channel_map that matches the electrodeGroup to clone
      const nTrodes = structuredClone(
        ntrodeElectrodeGroupChannelMap.filter((nTrode) => {
          return nTrode.electrode_group_id === electrodeGroup.id;
        })
      );

      // ntrode_id increments; find largest one and use that as a base for new nTrodes
      let largestNtrodeElectrodeGroupId =
        ntrodeElectrodeGroupChannelMap.length === 0
          ? 0
          : Math.max(...ntrodeElectrodeGroupChannelMap.map((n) => n.ntrode_id));

      nTrodes.forEach((n) => {
        largestNtrodeElectrodeGroupId += 1;
        n.electrode_group_id = clonedElectrodeGroup.id;
        n.ntrode_id = largestNtrodeElectrodeGroupId;
      });

      form.ntrode_electrode_group_channel_map.push(...nTrodes);

      // place the new cloned item in from of the item just cloned
      const electrodeGroupIndex = form[key].findIndex((eg) => eg.id === electrodeGroup.id);
      form[key].splice(electrodeGroupIndex + 1, 0, clonedElectrodeGroup);
      setFormData(form);
    },
    [formData, setFormData]
  );

  return {
    nTrodeMapSelected,
    removeElectrodeGroupItem,
    duplicateElectrodeGroupItem,
  };
}
