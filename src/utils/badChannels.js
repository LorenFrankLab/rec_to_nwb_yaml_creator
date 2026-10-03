/**
 * Bad channels in a metadata file versus in the form.
 *
 * In a file, trodes_to_nwb reads `bad_channels` only from the FIRST
 * ntrode_electrode_group_channel_map row of each electrode group, and reads
 * each value as a probe electrode id (convert_yaml.py add_electrode_groups); a
 * later row's list is never read. A row's `map` takes the row's local channel
 * (key) to a probe electrode id (value) (convert_rec_header.py
 * make_hw_channel_map).
 *
 * The form shows one checkbox list per row, labelled with the row's channel
 * keys, and keeps the ticked keys on that row. So:
 * - toFileBadChannels (download): each ticked key becomes the electrode it maps
 *   to, collected on the group's first row; later rows get [].
 * - canonicalizeFileBadChannels (upload, before validation): a later row's
 *   list, written by earlier versions of this page as that row's own channel
 *   keys, is translated and moved to the first row the same way.
 * - toFormBadChannels (upload, after validation): each first-row electrode id
 *   becomes a tick on the row and channel that map to it.
 *
 * A value that is not one of its row's channel keys is kept unchanged as an
 * electrode id: the upload keeps a first-row id that no channel maps to that
 * way, so it is written back as it was and validation sees it. A tick on a
 * channel with no electrode assigned (-1, the map's empty option) is left out
 * of the file: there is no electrode to mark, and the map value itself fails
 * validation until the channel is assigned.
 */

const isElectrodeId = (value) => Number.isInteger(value) && value >= 0;

const isMap = (map) => map !== null && typeof map === 'object' && !Array.isArray(map);

/** Whether `value` is one of the channel keys of `map`. */
const isChannelOf = (map, value) =>
  Number.isInteger(value) && isMap(map) && Object.hasOwn(map, String(value));

/**
 * The electrode id a row's bad-channel value stands for in a file, or undefined
 * when it marks a channel with no electrode assigned.
 *
 * @param {object} row - Channel-map row
 * @param {*} value - A value of the row's bad_channels in the form
 * @returns {*} The electrode id, the value itself when it is not one of the
 *   row's channels, or undefined
 */
const electrodeOf = (row, value) => {
  if (!isChannelOf(row.map, value)) return value;
  const id = row.map[String(value)];
  return isElectrodeId(id) ? id : undefined;
};

const addOnce = (list, value) => {
  if (value !== undefined && !list.includes(value)) list.push(value);
};

const hasMarks = (row) => Array.isArray(row?.bad_channels) && row.bad_channels.length > 0;

const anyRowHasMarks = (rows) => rows.some(hasMarks);

/**
 * Group channel-map rows by electrode group, groups and rows in file order. A
 * row without a group id is its own group (it is never read as part of another).
 *
 * @param {object[]} rows - ntrode_electrode_group_channel_map
 * @returns {object[][]} The rows of each group
 */
const groupRows = (rows) => {
  const groups = new Map();
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object') return;
    const groupId = row.electrode_group_id;
    const key = groupId === undefined || groupId === null ? Symbol(index) : groupId;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return [...groups.values()];
};

/**
 * Return a copy of `model` with `update` applied to the rows of each electrode
 * group, or `model` itself when `needed` is false for every group.
 *
 * @param {object} model - Form data or parsed file
 * @param {(rows: object[]) => void} update - Changes one group's rows in place
 * @param {(rows: object[]) => boolean} needed - Whether a group needs `update`
 * @returns {object} The same object, or an updated structuredClone
 */
const updateGroups = (model, update, needed) => {
  const rows = model?.ntrode_electrode_group_channel_map;
  if (!Array.isArray(rows) || !groupRows(rows).some(needed)) return model;

  const updated = structuredClone(model);
  groupRows(updated.ntrode_electrode_group_channel_map).forEach((groupRowList) => {
    // A row whose list is not an array is left for validation to report.
    if (groupRowList.every((row) => Array.isArray(row.bad_channels))) {
      update(groupRowList);
    }
  });
  return updated;
};

/**
 * File shape, for the download: every row's ticked channels as the electrode
 * ids they map to, on the group's first row; later rows [].
 *
 * @param {object} form - Form data
 * @returns {object} A converted copy, or `form` itself when no row has a bad channel
 */
export const toFileBadChannels = (form) =>
  updateGroups(
    form,
    (rows) => {
      const ids = [];
      rows.forEach((row) => {
        row.bad_channels.forEach((value) => addOnce(ids, electrodeOf(row, value)));
      });
      rows.forEach((row, index) => {
        row.bad_channels = index === 0 ? ids : [];
      });
    },
    anyRowHasMarks
  );

/**
 * Canonical file shape, for an upload before validation: a later row's list
 * (that row's own channel keys, as earlier versions wrote them) moves to the
 * group's first row as electrode ids. A group whose later rows are empty is left
 * exactly as written.
 *
 * @param {object} file - Parsed metadata file
 * @returns {object} A converted copy, or `file` itself when no later row has a bad channel
 */
export const canonicalizeFileBadChannels = (file) =>
  updateGroups(
    file,
    ([first, ...later]) => {
      later.forEach((row) => {
        row.bad_channels.forEach((value) => addOnce(first.bad_channels, electrodeOf(row, value)));
        row.bad_channels = [];
      });
    },
    ([, ...later]) => later.some(hasMarks)
  );

/**
 * Form shape, for an upload after validation: each first-row electrode id
 * becomes a tick on the row and channel that map to it. An id that no channel
 * maps to stays on the first row unchanged.
 *
 * @param {object} file - Canonical metadata file (see canonicalizeFileBadChannels)
 * @returns {object} A converted copy, or `file` itself when no row has a bad channel
 */
export const toFormBadChannels = (file) =>
  updateGroups(
    file,
    (rows) => {
      // The row and channel each electrode id is mapped from; the first wins if
      // a broken map lists an id twice.
      const channelOf = new Map();
      rows.forEach((row, rowIndex) => {
        Object.entries(isMap(row.map) ? row.map : {}).forEach(([key, id]) => {
          const channel = Number(key);
          if (
            Number.isInteger(channel) &&
            String(channel) === key &&
            isElectrodeId(id) &&
            !channelOf.has(id)
          ) {
            channelOf.set(id, { rowIndex, channel });
          }
        });
      });

      const [first] = rows;
      const ids = first.bad_channels;
      first.bad_channels = [];
      ids.forEach((id) => {
        const target = channelOf.get(id);
        if (target) {
          addOnce(rows[target.rowIndex].bad_channels, target.channel);
        } else {
          addOnce(first.bad_channels, id);
        }
      });
    },
    anyRowHasMarks
  );
