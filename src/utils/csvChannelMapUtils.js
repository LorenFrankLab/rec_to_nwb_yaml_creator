/**
 * CSV Channel Map Import/Export Utilities
 *
 * Utilities for importing and exporting channel maps as CSV files.
 * Allows users to bulk-edit channel maps in spreadsheet software.
 */

import { nextNtrodeId } from './channelMapUtils';
import { parseExactInteger } from './deviceNormalization';

/**
 * Returns the number of channel entries (map keys) in a single channel map.
 *
 * @param {object} channelMap - A channel map object with a `map` field
 * @returns {number} The count of map keys (0 if `map` is missing/empty)
 * @private
 */
function mapKeyCount(channelMap) {
  return channelMap && channelMap.map ? Object.keys(channelMap.map).length : 0;
}

/**
 * Exports channel maps to CSV format
 *
 * Creates a CSV representation of channel maps with electrode group context.
 * Includes header row and formats bad_channels as quoted comma-separated string.
 *
 * The number of `channel_*` columns is driven by the WIDEST row (the maximum
 * map-key count across all rows), not the first row. This is required for
 * uneven-shank probes (e.g. `64c-3s6mm6cm-20um-40um-sl`, whose shanks hold
 * 21/21/22 channels): using the first row's count would silently drop
 * `channel_21` / electrode id 63 on the wider third shank. Rows narrower than
 * the widest are padded with empty trailing cells so every row aligns with the
 * header. For even probes every row has the same count, so the max equals the
 * first row's count and output is unchanged (byte-identical).
 *
 * @param {Array<object>} channelMaps - Array of channel map objects
 * @param {Array<object>} electrodeGroups - Array of electrode group objects
 * @returns {string} CSV formatted string
 *
 * @example
 * const maps = [{
 *   electrode_group_id: 0,
 *   ntrode_id: 0,
 *   bad_channels: [],
 *   map: { 0: 0, 1: 1, 2: 2, 3: 3 }
 * }];
 * const groups = [{ id: 0, device_type: 'tetrode_12.5', location: 'CA1' }];
 * exportChannelMapsToCSV(maps, groups);
 * // Returns:
 * // electrode_group_id,device_type,location,ntrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
 * // 0,tetrode_12.5,CA1,0,"",0,1,2,3
 */
export function exportChannelMapsToCSV(channelMaps, electrodeGroups) {
  if (!channelMaps || channelMaps.length === 0) {
    return '';
  }

  // Create lookup map for electrode groups
  const groupLookup = electrodeGroups.reduce((acc, group) => {
    acc[group.id] = group;
    return acc;
  }, {});

  // Determine channel count from the WIDEST row (max map-key count across all
  // rows) so uneven-shank probes don't drop the extra channel(s) of a wider
  // shank. For even probes this equals every row's count (output unchanged).
  const channelCount = channelMaps.reduce(
    (max, channelMap) => Math.max(max, mapKeyCount(channelMap)),
    0
  );

  // Build header row. `electrode_id` is not a schema field on the ntrode and is no
  // longer part of the channel-map shape, so it is not emitted.
  const channelHeaders = Array.from({ length: channelCount }, (_, i) => `channel_${i}`);
  const headers = [
    'electrode_group_id',
    'device_type',
    'location',
    'ntrode_id',
    'bad_channels',
    ...channelHeaders
  ];

  // Build data rows
  const rows = channelMaps.map(channelMap => {
    const group = groupLookup[channelMap.electrode_group_id] || {};

    // Format bad_channels array as quoted comma-separated string
    const badChannelsStr = channelMap.bad_channels.length > 0
      ? `"${channelMap.bad_channels.join(',')}"`
      : '""';

    // Extract channel values from map object. Rows narrower than the widest row
    // emit empty trailing cells for the missing higher channel indices so the
    // CSV stays rectangular (header-aligned).
    const channelValues = Array.from({ length: channelCount }, (_, i) => {
      return channelMap.map[i] !== undefined ? channelMap.map[i] : '';
    });

    return [
      channelMap.electrode_group_id,
      group.device_type || '',
      group.location || '',
      channelMap.ntrode_id,
      badChannelsStr,
      ...channelValues
    ].join(',');
  });

  // Combine header and rows
  return [headers.join(','), ...rows].join('\n');
}

/**
 * Parses a CSV row, handling quoted values
 *
 * @param {string} row - CSV row string
 * @returns {Array<string>} Array of cell values
 * @private
 */
function parseCSVRow(row) {
  const cells = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(currentCell);
      currentCell = '';
    } else {
      currentCell += char;
    }
  }

  // Push the last cell
  cells.push(currentCell);

  return cells;
}

/**
 * Imports channel maps from CSV format
 *
 * Parses CSV string and converts to channel map objects.
 * Validates required columns and numeric values.
 *
 * IDs are emitted as integers (schema requires integer `ntrode_id` /
 * `electrode_group_id`). `ntrode_id` values are renumbered to a contiguous integer
 * sequence starting after the current max in `existingMaps`, so imported ntrodes
 * never collide with existing ones. The non-schema `electrode_id` column is
 * tolerated but ignored (not carried onto the ntrode).
 *
 * Empty channel cells are skipped, not treated as channels. Uneven-shank probes
 * export rectangular CSVs where narrower shanks have empty trailing channel cells
 * (see `exportChannelMapsToCSV`); those padded cells must not become phantom
 * channels (or NaN errors) on re-import.
 *
 * @param {string} csvString - CSV formatted string
 * @param {Array<object>} [existingMaps=[]] - Existing channel maps to renumber past.
 * @returns {Array<object>} Array of channel map objects
 * @throws {Error} If CSV is invalid or missing required columns
 *
 * @example
 * const csv = `electrode_group_id,device_type,location,ntrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
 * 0,tetrode_12.5,CA1,0,"",0,1,2,3`;
 * importChannelMapsFromCSV(csv);
 * // Returns: [{ electrode_group_id: 0, ntrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }]
 */
export function importChannelMapsFromCSV(csvString, existingMaps = []) {
  const lines = csvString.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV must contain header and at least one data row');
  }

  // Parse header
  const headers = parseCSVRow(lines[0]);

  // Validate required columns. `electrode_id` is no longer required (it is not a
  // schema field on the ntrode); older CSVs that still include it are tolerated.
  const requiredColumns = [
    'electrode_group_id',
    'ntrode_id',
    'bad_channels'
  ];

  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      throw new Error(`Missing required columns: ${col}`);
    }
  }

  // Find channel columns (channel_0, channel_1, etc.)
  const channelColumns = headers
    .map((h, i) => ({ header: h, index: i }))
    .filter(({ header }) => header.startsWith('channel_'));

  if (channelColumns.length === 0) {
    throw new Error('Missing required columns: No channel columns found');
  }

  // Parse data rows. ntrode_id is renumbered to a contiguous integer sequence
  // starting after the current max existing ntrode_id (collision-safe).
  const channelMaps = [];
  let assignedNtrodeId = nextNtrodeId(existingMaps);

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);

    if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
      continue; // Skip empty lines
    }

    // Extract values. electrode_group_id is parsed to an integer (schema type).
    const electrode_group_id_str = cells[headers.indexOf('electrode_group_id')];
    // electrode_group_id is a structurally-required integer (schema type). Use
    // EXACT integer parsing (Normalization Contract): "2" -> 2, but "2.9" /
    // "63abc" / "" are rejected with a clear, cell-naming error rather than
    // silently truncated by parseInt ("2.9" -> 2).
    const electrode_group_id = parseExactInteger(electrode_group_id_str);
    if (!Number.isInteger(electrode_group_id)) {
      throw new Error(`Invalid numeric value for electrode_group_id at row ${i + 1}: "${electrode_group_id_str}"`);
    }
    const bad_channels_str = cells[headers.indexOf('bad_channels')];

    // Parse bad_channels (empty quotes "" or "1,2,3")
    let bad_channels = [];
    if (bad_channels_str && bad_channels_str !== '') {
      const values = bad_channels_str.split(',').map(v => v.trim());
      bad_channels = values
        .filter(v => v !== '')
        // Exact integer-string -> integer; anything else ("2.9", "63abc") is
        // PRESERVED unchanged (Normalization Contract) so the channel-bound
        // rules flag it instead of parseInt silently flooring "2.9" -> 2.
        .map(v => parseExactInteger(v));
    }

    // Parse channel map
    const map = {};
    for (const { index } of channelColumns) {
      const channelValue = cells[index];

      // Skip empty/missing cells. Uneven-shank probes are exported as
      // rectangular CSVs where narrower shanks have empty trailing channel
      // cells (padding); those must not become phantom channels or NaN errors.
      if (channelValue === undefined || channelValue.trim() === '') {
        continue;
      }

      // Exact integer-string -> integer; anything else ("2.9", "63abc") is
      // PRESERVED unchanged (Normalization Contract) so the channel-bound rules
      // surface it instead of parseInt silently truncating "2.9" -> 2.
      const channelNum = parseExactInteger(channelValue);

      // The channel index comes from an app-generated header ("channel_0" -> 0)
      // and is a structurally-required integer key; reject (don't truncate) a
      // malformed header column rather than writing to a corrupt key.
      const channelIndex = parseExactInteger(headers[index].split('_')[1]);
      if (!Number.isInteger(channelIndex)) {
        throw new Error(`Invalid channel column header at row ${i + 1}: "${headers[index]}"`);
      }
      map[channelIndex] = channelNum;
    }

    channelMaps.push({
      electrode_group_id,
      ntrode_id: assignedNtrodeId,
      bad_channels,
      map
    });
    assignedNtrodeId += 1;
  }

  return channelMaps;
}

/**
 * Downloads channel maps as a CSV file
 *
 * Generates CSV content and triggers browser download with specified filename.
 *
 * @param {Array<object>} channelMaps - Array of channel map objects
 * @param {Array<object>} electrodeGroups - Array of electrode group objects
 * @param {string} filename - Filename for download (e.g., "remy_channel_maps.csv")
 *
 * @example
 * downloadChannelMapsCSV(maps, groups, "remy_channel_maps.csv");
 * // Triggers browser download
 */
export function downloadChannelMapsCSV(channelMaps, electrodeGroups, filename) {
  // Generate CSV content
  const csvContent = exportChannelMapsToCSV(channelMaps, electrodeGroups);

  // Create blob
  const blob = new Blob([csvContent], { type: 'text/csv' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;

  // Trigger download
  anchor.click();

  // Cleanup
  URL.revokeObjectURL(url);
}
