/**
 * @vitest-environment jsdom
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  exportChannelMapsToCSV,
  importChannelMapsFromCSV,
  downloadChannelMapsCSV
} from '../csvChannelMapUtils';

describe('exportChannelMapsToCSV', () => {
  test('exports tetrode channel maps correctly', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      },
      {
        electrode_group_id: '0',
        ntrode_id: '1',
        electrode_id: 1,
        bad_channels: [1, 3],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1'
      }
    ];

    const csv = exportChannelMapsToCSV(channelMaps, electrodeGroups);

    expect(csv).toContain('electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3');
    expect(csv).toContain('0,tetrode_12.5,CA1,0,0,"",0,1,2,3');
    expect(csv).toContain('0,tetrode_12.5,CA1,1,1,"1,3",0,1,2,3');
  });

  test('exports 32-channel probe maps correctly', () => {
    const channelMaps = [
      {
        electrode_group_id: '1',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: {
          0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7,
          8: 8, 9: 9, 10: 10, 11: 11, 12: 12, 13: 13, 14: 14, 15: 15,
          16: 16, 17: 17, 18: 18, 19: 19, 20: 20, 21: 21, 22: 22, 23: 23,
          24: 24, 25: 25, 26: 26, 27: 27, 28: 28, 29: 29, 30: 30, 31: 31
        }
      }
    ];

    const electrodeGroups = [
      {
        id: '1',
        device_type: 'A1x32-6mm-50-177-H32_21mm',
        location: 'CA1'
      }
    ];

    const csv = exportChannelMapsToCSV(channelMaps, electrodeGroups);

    expect(csv).toContain('channel_0,channel_1,channel_2,channel_3');
    expect(csv).toContain('channel_28,channel_29,channel_30,channel_31');
    expect(csv).toContain('1,A1x32-6mm-50-177-H32_21mm,CA1,0,0,"",0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31');
  });

  test('includes electrode group context', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA3'
      }
    ];

    const csv = exportChannelMapsToCSV(channelMaps, electrodeGroups);

    expect(csv).toContain('device_type');
    expect(csv).toContain('location');
    expect(csv).toContain('tetrode_12.5');
    expect(csv).toContain('CA3');
  });

  test('handles bad_channels array (empty and populated)', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      },
      {
        electrode_group_id: '0',
        ntrode_id: '1',
        electrode_id: 1,
        bad_channels: [0, 2],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1'
      }
    ];

    const csv = exportChannelMapsToCSV(channelMaps, electrodeGroups);

    expect(csv).toContain('0,0,""');
    expect(csv).toContain('1,1,"0,2"');
  });

  test('includes header row with correct columns', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1'
      }
    ];

    const csv = exportChannelMapsToCSV(channelMaps, electrodeGroups);
    const lines = csv.split('\n');
    const header = lines[0];

    expect(header).toBe('electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3');
  });
});

describe('importChannelMapsFromCSV', () => {
  test('imports valid CSV correctly', () => {
    const csv = `electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
0,tetrode_12.5,CA1,0,0,"",0,1,2,3
0,tetrode_12.5,CA1,1,1,"1,3",0,1,2,3`;

    const result = importChannelMapsFromCSV(csv);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      electrode_group_id: '0',
      ntrode_id: '0',
      electrode_id: 0,
      bad_channels: [],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 }
    });
    expect(result[1]).toEqual({
      electrode_group_id: '0',
      ntrode_id: '1',
      electrode_id: 1,
      bad_channels: [1, 3],
      map: { 0: 0, 1: 1, 2: 2, 3: 3 }
    });
  });

  test('parses bad_channels string to array', () => {
    const csv = `electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
0,tetrode_12.5,CA1,0,0,"0,2,3",0,1,2,3`;

    const result = importChannelMapsFromCSV(csv);

    expect(result[0].bad_channels).toEqual([0, 2, 3]);
  });

  test('parses map columns to map object', () => {
    const csv = `electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
0,tetrode_12.5,CA1,0,0,"",5,10,15,20`;

    const result = importChannelMapsFromCSV(csv);

    expect(result[0].map).toEqual({ 0: 5, 1: 10, 2: 15, 3: 20 });
  });

  test('throws error for missing required columns', () => {
    const csv = `electrode_group_id,ntrode_id,electrode_id
0,0,0`;

    expect(() => importChannelMapsFromCSV(csv)).toThrow('Missing required columns');
  });

  test('throws error for invalid numeric values', () => {
    const csv = `electrode_group_id,device_type,location,ntrode_id,electrode_id,bad_channels,channel_0,channel_1,channel_2,channel_3
0,tetrode_12.5,CA1,0,invalid,"",0,1,2,3`;

    expect(() => importChannelMapsFromCSV(csv)).toThrow('Invalid numeric value');
  });
});

describe('downloadChannelMapsCSV', () => {
  // Mock DOM APIs for testing
  let mockAnchor;
  let mockBlobInstance;
  let mockURL;

  beforeEach(() => {
    // Mock anchor element
    mockAnchor = {
      href: '',
      download: '',
      click: vi.fn()
    };

    // Mock document.createElement
    global.document.createElement = vi.fn().mockReturnValue(mockAnchor);

    // Mock Blob constructor - must be a class constructor
    mockBlobInstance = { content: null, options: null };
    global.Blob = vi.fn(function(content, options) {
      mockBlobInstance.content = content;
      mockBlobInstance.options = options;
      return mockBlobInstance;
    });

    // Mock URL.createObjectURL and revokeObjectURL
    mockURL = vi.fn().mockReturnValue('blob:mock-url');
    global.URL = {
      createObjectURL: mockURL,
      revokeObjectURL: vi.fn()
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('creates blob with correct MIME type', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1'
      }
    ];

    downloadChannelMapsCSV(channelMaps, electrodeGroups, 'test.csv');

    expect(global.Blob).toHaveBeenCalled();
    const blobCall = global.Blob.mock.calls[0];
    expect(blobCall[1]).toEqual({ type: 'text/csv' });
  });

  test('triggers download with correct filename', () => {
    const channelMaps = [
      {
        electrode_group_id: '0',
        ntrode_id: '0',
        electrode_id: 0,
        bad_channels: [],
        map: { 0: 0, 1: 1, 2: 2, 3: 3 }
      }
    ];

    const electrodeGroups = [
      {
        id: '0',
        device_type: 'tetrode_12.5',
        location: 'CA1'
      }
    ];

    downloadChannelMapsCSV(channelMaps, electrodeGroups, 'remy_channel_maps.csv');

    expect(mockAnchor.download).toBe('remy_channel_maps.csv');
    expect(mockAnchor.click).toHaveBeenCalled();
  });
});
