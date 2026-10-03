import { useCallback } from 'react';
import { getProbeShanks } from '../ntrode/probeCatalog';
import { arrayDefaultValues } from '../valueList';

/**
 * The lowest positive whole numbers not in use, as many as asked for. New ntrodes take these:
 * trodes_to_nwb looks up each of the .rec header's ntrodes (numbered 1..N) by ntrode_id, and the
 * form shows ntrode ids read-only, so a gap left by a removed group must be filled by the next new
 * ntrodes or it can never be closed. Ids in use are never changed.
 *
 * @param {Array} usedIds - The ntrode ids in use
 * @param {number} count - How many ids are needed
 * @returns {number[]} The ids, in increasing order
 */
const lowestUnusedIds = (usedIds, count) => {
  const used = new Set(usedIds);
  const ids = [];
  for (let id = 1; ids.length < count; id += 1) {
    if (!used.has(id)) ids.push(id);
  }
  return ids;
};

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
   * 3. Replaces this group's old ntrode maps with them, in the same place
   * 4. Gives them the group's old ntrode_ids in order; extra shanks get the
   *    lowest unused ids. Other groups' ntrodes are untouched.
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

      form[key][index].device_type = value;

      // The probe catalog (probeCatalog.js) is the SOURCE OF TRUTH for how a
      // probe's electrode ids partition across shanks. Routing legacy generation
      // through it (instead of first-shank length math) keeps even probes
      // byte-identical AND fixes the unevenly-partitioned 64c-3s probe, where the
      // old math silently dropped electrode ids 60-63 (only 21 keys on the third
      // shank instead of 22). This mirrors the modern generateChannelMapsForGroup.
      const shanks = getProbeShanks(value);

      const nTrodes = [];

      // One ntrode per shank. Local keys are 0..(shankLen-1); the VALUES are the
      // shank's actual probe electrode ids (already carrying any multi-shank
      // offset from the catalog). bad_channel defaults are left as-is.
      shanks.forEach((shank) => {
        const nTrodeBase = structuredClone(
          arrayDefaultValues.ntrode_electrode_group_channel_map
        );

        const nTrodeMap = {};
        shank.electrodeIds.forEach((electrodeId, localKey) => {
          nTrodeMap[localKey] = electrodeId;
        });

        nTrodeBase.electrode_group_id = electrodeGroupId;
        nTrodeBase.map = nTrodeMap;

        nTrodes.push(nTrodeBase);
      });

      // Replace this group's ntrodes where they are and leave every other
      // ntrode alone. trodes_to_nwb matches the .rec header's ntrode ids to
      // ntrode_id, so renumbering another group's ntrodes would silently file
      // its hardware channels under a different electrode group.
      const channelMap = form.ntrode_electrode_group_channel_map || [];
      const isThisGroup = (n) => n.electrode_group_id === electrodeGroupId;
      const otherNtrodes = channelMap.filter((n) => !isThisGroup(n));
      const otherIds = otherNtrodes.map((n) => n.ntrode_id);

      // The group keeps its ntrode ids, in order (skipping any another group
      // also uses); shanks beyond them get the lowest ids no ntrode uses.
      const keptIds = [
        ...new Set(channelMap.filter(isThisGroup).map((n) => n.ntrode_id)),
      ].filter((id) => Number.isInteger(id) && !otherIds.includes(id))
        .slice(0, nTrodes.length);
      const newIds = lowestUnusedIds(
        [...otherIds, ...keptIds],
        nTrodes.length - keptIds.length
      );

      nTrodes.forEach((n, nIndex) => {
        n.ntrode_id = nIndex < keptIds.length ? keptIds[nIndex] : newIds[nIndex - keptIds.length];
      });

      // In place of the group's first old ntrode; a group without any yet
      // gets them at the end.
      const position = channelMap.findIndex(isThisGroup);
      otherNtrodes.splice(position === -1 ? otherNtrodes.length : position, 0, ...nTrodes);
      form.ntrode_electrode_group_channel_map = otherNtrodes;

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
   * 3. Duplicates ntrode maps with the lowest unused ntrode_ids
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

      // The copies take the lowest ntrode ids no ntrode uses
      const newIds = lowestUnusedIds(
        ntrodeElectrodeGroupChannelMap.map((n) => n.ntrode_id),
        nTrodes.length
      );

      nTrodes.forEach((n, nIndex) => {
        n.electrode_group_id = clonedElectrodeGroup.id;
        n.ntrode_id = newIds[nIndex];
      });

      form.ntrode_electrode_group_channel_map.push(...nTrodes);

      // place the new cloned item in from of the item just cloned
      const electrodeGroupIndex = form[key].findIndex((eg) => eg.id === electrodeGroup.id);
      form[key].splice(electrodeGroupIndex + 1, 0, clonedElectrodeGroup);
      setFormData(form);
    },
    [formData, setFormData]
  );

  /**
   * Changes an electrode group's id and moves its ntrode channel maps with it
   *
   * The maps belong to the group through electrode_group_id, so they are
   * re-pointed in the same update; maps left on the old id would belong to
   * no group, or to whichever group takes that id next. Only a whole number
   * that no other group uses is accepted, so two groups never claim the same
   * maps; anything else leaves the form unchanged. If another group already
   * shared the old id (e.g. an imported file), whose maps are whose cannot
   * be told, so the maps stay where they are.
   *
   * @param {number} index - The index of the electrode group
   * @param {string|number} value - The new id, as typed
   * @returns {null} Always returns null
   */
  const changeElectrodeGroupId = useCallback(
    (index, value) => {
      const text = String(value).trim();
      const newId = /^\d+$/.test(text) ? Number(text) : NaN;
      const electrodeGroups = formData.electrode_groups || [];
      const electrodeGroup = electrodeGroups[index];

      if (!electrodeGroup || !Number.isSafeInteger(newId) || newId === electrodeGroup.id) {
        return null;
      }

      const otherIds = electrodeGroups.filter((_, i) => i !== index).map((eg) => eg.id);

      if (otherIds.includes(newId)) {
        return null;
      }

      const form = structuredClone(formData);
      const oldId = electrodeGroup.id;
      form.electrode_groups[index].id = newId;

      if (!otherIds.includes(oldId)) {
        (form.ntrode_electrode_group_channel_map || []).forEach((n) => {
          if (n.electrode_group_id === oldId) {
            n.electrode_group_id = newId;
          }
        });
      }

      setFormData(form);
      return null;
    },
    [formData, setFormData]
  );

  return {
    nTrodeMapSelected,
    removeElectrodeGroupItem,
    duplicateElectrodeGroupItem,
    changeElectrodeGroupId,
  };
}
