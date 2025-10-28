/**
 * CSV Channel Map Import/Export Utilities
 *
 * Utilities for importing and exporting channel maps as CSV files.
 * Allows users to bulk-edit channel maps in spreadsheet software.
 */

/**
 * Exports channel maps to CSV format
 *
 * Creates a CSV representation of channel maps with electrode group context.
 * Includes header row and formats bad_channels as quoted comma-separated string.
 *
 * @param {Array<object>} channelMaps - Array of channel map objects
 * @param {Array<object>} electrodeGroups - Array of electrode group objects
 * @returns {string} CSV formatted string
 *
 * @example
 * const maps = [{
 *   electrode_group_id: '0',
 *   ntrode_id: '0',
 *   electrode_id: 0,
 *   bad_channels: [],
 *   map: { 0: 0, 1: 1, 2: 2, 3: 3 }
 * }];
 * const groups = [{ id: '0', device_type: 'tetrode_12.5', location: 'CA1' }];
 * exportChannelMapsToCSV(maps, groups);
 * // Returns:
 * // electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
 * // 0,tetrode_12.5,CA1,0,0,"",0,1,2,3
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

  // Determine channel count from first map
  const firstMap = channelMaps[0];
  const channelCount = Object.keys(firstMap.map).length;

  // Build header row
  const channelHeaders = Array.from({ length: channelCount }, (_, i) => `channel_${i}`);
  const headers = [
    'electrode_group_id',
    'device_type',
    'location',
    'ntrode_id',
    'electrode_id',
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

    // Extract channel values from map object
    const channelValues = Array.from({ length: channelCount }, (_, i) => {
      return channelMap.map[i] !== undefined ? channelMap.map[i] : '';
    });

    return [
      channelMap.electrode_group_id,
      group.device_type || '',
      group.location || '',
      channelMap.ntrode_id,
      channelMap.electrode_id,
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
 * @param {string} csvString - CSV formatted string
 * @returns {Array<object>} Array of channel map objects
 * @throws {Error} If CSV is invalid or missing required columns
 *
 * @example
 * const csv = `electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
 * 0,tetrode_12.5,CA1,0,0,"",0,1,2,3`;
 * importChannelMapsFromCSV(csv);
 * // Returns: [{ electrode_group_id: '0', ntrode_id: '0', electrode_id: 0, bad_channels: [], map: { 0: 0, 1: 1, 2: 2, 3: 3 } }]
 */
export function importChannelMapsFromCSV(csvString) {
  const lines = csvString.trim().split('\n');

  if (lines.length < 2) {
    throw new Error('CSV must contain header and at least one data row');
  }

  // Parse header
  const headers = parseCSVRow(lines[0]);

  // Validate required columns
  const requiredColumns = [
    'electrode_group_id',
    'ntrode_id',
    'electrode_id',
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

  // Parse data rows
  const channelMaps = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);

    if (cells.length === 0 || (cells.length === 1 && cells[0] === '')) {
      continue; // Skip empty lines
    }

    // Extract values
    const electrode_group_id = cells[headers.indexOf('electrode_group_id')];
    const ntrode_id = cells[headers.indexOf('ntrode_id')];
    const electrode_id_str = cells[headers.indexOf('electrode_id')];
    const bad_channels_str = cells[headers.indexOf('bad_channels')];

    // Validate and parse electrode_id
    const electrode_id = parseInt(electrode_id_str, 10);
    if (isNaN(electrode_id)) {
      throw new Error(`Invalid numeric value for electrode_id at row ${i + 1}: "${electrode_id_str}"`);
    }

    // Parse bad_channels (empty quotes "" or "1,2,3")
    let bad_channels = [];
    if (bad_channels_str && bad_channels_str !== '') {
      const values = bad_channels_str.split(',').map(v => v.trim());
      bad_channels = values
        .filter(v => v !== '')
        .map(v => {
          const num = parseInt(v, 10);
          if (isNaN(num)) {
            throw new Error(`Invalid numeric value in bad_channels at row ${i + 1}: "${v}"`);
          }
          return num;
        });
    }

    // Parse channel map
    const map = {};
    for (const { index } of channelColumns) {
      const channelValue = cells[index];
      const channelNum = parseInt(channelValue, 10);

      if (isNaN(channelNum)) {
        throw new Error(`Invalid numeric value for channel at row ${i + 1}: "${channelValue}"`);
      }

      // Extract channel index from header (e.g., "channel_0" → 0)
      const channelIndex = parseInt(headers[index].split('_')[1], 10);
      map[channelIndex] = channelNum;
    }

    channelMaps.push({
      electrode_group_id,
      ntrode_id,
      electrode_id,
      bad_channels,
      map
    });
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
