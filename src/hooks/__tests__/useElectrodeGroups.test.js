/**
 * @file useElectrodeGroups.test.js
 * @description Tests for useElectrodeGroups hook
 *
 * Hook: useElectrodeGroups(formData, setFormData)
 * Location: src/hooks/useElectrodeGroups.js
 *
 * Purpose: Manage electrode group operations including ntrode channel map synchronization
 *
 * Functions tested:
 * - nTrodeMapSelected(e, metaData) - Auto-generates ntrode channel maps when device type selected
 * - removeElectrodeGroupItem(index, key) - Removes electrode group and associated ntrode maps
 * - duplicateElectrodeGroupItem(index, key) - Duplicates electrode group with new ID and ntrode maps
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { useElectrodeGroups } from '../useElectrodeGroups';
import { deviceTypes } from '../../valueList';

/**
 * Test wrapper that provides formData state and useElectrodeGroups hook
 */
function useTestHook() {
  const [formData, setFormData] = useState({
    electrode_groups: [],
    ntrode_electrode_group_channel_map: [],
  });

  const { nTrodeMapSelected, removeElectrodeGroupItem, duplicateElectrodeGroupItem } =
    useElectrodeGroups(formData, setFormData);

  return { formData, nTrodeMapSelected, removeElectrodeGroupItem, duplicateElectrodeGroupItem };
}

describe('useElectrodeGroups', () => {
  describe('nTrodeMapSelected', () => {
    describe('Device Type Assignment', () => {
      it('should set device_type on electrode group', () => {
        const { result } = renderHook(() => useTestHook());

        // Add electrode group manually
        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        // Create mock event
        const mockEvent = {
          target: { value: 'tetrode_12.5' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.electrode_groups[0].device_type).toBe('tetrode_12.5');
      });

      it('should update device_type when changed to different value', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: 'tetrode_12.5', location: '' }];
        });

        const mockEvent = {
          target: { value: 'A1x32-6mm-50-177-H32_21mm' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.electrode_groups[0].device_type).toBe('A1x32-6mm-50-177-H32_21mm');
      });
    });

    describe('Ntrode Generation Based on Shank Count', () => {
      it('should generate 1 ntrode for single-shank device (tetrode)', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: 'tetrode_12.5' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(1);
      });

      it('should generate 2 ntrodes for 2-shank device', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(2);
      });

      it('should generate 4 ntrodes for 4-shank device', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: '128c-4s6mm6cm-15um-26um-sl' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(4);
      });
    });

    describe('Ntrode Map Structure', () => {
      it('should set electrode_group_id on generated ntrodes', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 5, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: 'tetrode_12.5' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(5);
      });

      it('should create map object with default channel mappings', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: 'tetrode_12.5' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        // Tetrode has channels 0, 1, 2, 3 mapped to themselves
        const ntrode = result.current.formData.ntrode_electrode_group_channel_map[0];
        expect(ntrode.map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
      });

      it('should offset channel mappings for multi-shank devices', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        // First shank maps to first 32 channels (0-31)
        // Second shank should have offsets
        expect(ntrodes[0].map).toBeDefined();
        expect(ntrodes[1].map).toBeDefined();
      });
    });

    describe('Ntrode ID Numbering', () => {
      it('should assign sequential ntrode_id values starting at 1', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        const mockEvent = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        const metaData = { key: 'electrode_groups', index: 0 };

        act(() => {
          result.current.nTrodeMapSelected(mockEvent, metaData);
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes[0].ntrode_id).toBe(1);
        expect(ntrodes[1].ntrode_id).toBe(2);
      });

      it('should number a later group\'s ntrodes after the ntrode_ids in use', () => {
        const { result } = renderHook(() => useTestHook());

        // Start with 2 electrode groups
        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' },
            { id: 1, device_type: '', location: '' }
          ];
        });

        // Set first electrode group device type (generates 1 ntrode)
        const mockEvent1 = {
          target: { value: 'tetrode_12.5' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent1, { key: 'electrode_groups', index: 0 });
        });

        // Set second electrode group device type (generates 2 more ntrodes)
        const mockEvent2 = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent2, { key: 'electrode_groups', index: 1 });
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes).toHaveLength(3);
        expect(ntrodes[0].ntrode_id).toBe(1);
        expect(ntrodes[1].ntrode_id).toBe(2);
        expect(ntrodes[2].ntrode_id).toBe(3);
      });
    });

    describe('Replacing Existing Ntrode Maps', () => {
      it('should remove old ntrode maps when device type changed', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [{ id: 0, device_type: '', location: '' }];
        });

        // Set first device type (generates 1 ntrode)
        const mockEvent1 = {
          target: { value: 'tetrode_12.5' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent1, { key: 'electrode_groups', index: 0 });
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(1);

        // Change to different device type (generates 2 ntrodes)
        const mockEvent2 = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent2, { key: 'electrode_groups', index: 0 });
        });

        // Should have 2 ntrodes (old 1 removed, new 2 added)
        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(2);
        expect(result.current.formData.ntrode_electrode_group_channel_map[0].electrode_group_id).toBe(0);
        expect(result.current.formData.ntrode_electrode_group_channel_map[1].electrode_group_id).toBe(0);
      });

      it('should preserve ntrode maps from other electrode groups', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' },
            { id: 1, device_type: '', location: '' }
          ];
        });

        // Set first electrode group device type
        const mockEvent1 = {
          target: { value: 'tetrode_12.5' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent1, { key: 'electrode_groups', index: 0 });
        });

        // Set second electrode group device type
        const mockEvent2 = {
          target: { value: '32c-2s8mm6cm-20um-40um-dl' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent2, { key: 'electrode_groups', index: 1 });
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(3);

        // Change first electrode group device type
        const mockEvent3 = {
          target: { value: 'A1x32-6mm-50-177-H32_21mm' }
        };
        act(() => {
          result.current.nTrodeMapSelected(mockEvent3, { key: 'electrode_groups', index: 0 });
        });

        // Should still have 3 ntrodes (1 new for first group, 2 preserved for second group)
        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes).toHaveLength(3);
        const group0Ntrodes = ntrodes.filter(n => n.electrode_group_id === 0);
        const group1Ntrodes = ntrodes.filter(n => n.electrode_group_id === 1);
        expect(group0Ntrodes).toHaveLength(1);
        expect(group1Ntrodes).toHaveLength(2);
      });
    });
  });

  describe('removeElectrodeGroupItem', () => {
    beforeEach(() => {
      // Mock window.confirm to always return true
      vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    describe('Basic Removal', () => {
      it('should remove electrode group when confirmed', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(0);
      });

      it('should show confirmation dialog with correct message', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(window.confirm).toHaveBeenCalledWith('Remove index 0 from electrode_groups?');
      });

      it('should not remove when user cancels', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(1);
      });

      it('should remove correct electrode group by index', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: 'CA1' },
            { id: 1, device_type: '', location: 'CA3' },
            { id: 2, device_type: '', location: 'DG' }
          ];
        });

        // Remove middle one (index 1)
        act(() => {
          result.current.removeElectrodeGroupItem(1, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(2);
        expect(result.current.formData.electrode_groups[0].location).toBe('CA1');
        expect(result.current.formData.electrode_groups[1].location).toBe('DG');
      });
    });

    describe('Associated Ntrode Map Removal', () => {
      it('should remove ntrode maps when electrode group removed', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(0);
      });

      it('should only remove ntrodes for removed electrode group', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' },
            { id: 1, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} },
            { ntrode_id: 2, electrode_group_id: 1, map: {} },
            { ntrode_id: 3, electrode_group_id: 1, map: {} }
          ];
        });

        // Remove first electrode group
        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes).toHaveLength(2);
        expect(ntrodes[0].electrode_group_id).toBe(1);
        expect(ntrodes[1].electrode_group_id).toBe(1);
      });

      it('should remove all ntrodes for multi-shank device', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} },
            { ntrode_id: 2, electrode_group_id: 0, map: {} },
            { ntrode_id: 3, electrode_group_id: 0, map: {} },
            { ntrode_id: 4, electrode_group_id: 0, map: {} }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.ntrode_electrode_group_channel_map).toHaveLength(0);
      });
    });

    describe('Guard Clauses', () => {
      it('should return null when items array is empty', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        // If we reached here without errors, the guard clause worked correctly
        expect(result.current.formData.electrode_groups).toEqual([]);
      });

      it('should return null when item at index does not exist', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        act(() => {
          result.current.removeElectrodeGroupItem(5, 'electrode_groups');
        });

        // Guard clause should prevent removal - original item should still exist
        expect(result.current.formData.electrode_groups).toHaveLength(1);
      });
    });

    describe('Immutability', () => {
      it('should use structuredClone for immutability', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        const originalFormData = result.current.formData;

        act(() => {
          result.current.removeElectrodeGroupItem(0, 'electrode_groups');
        });

        // formData reference should change (new object)
        expect(result.current.formData).not.toBe(originalFormData);
      });
    });
  });

  describe('duplicateElectrodeGroupItem', () => {
    describe('Basic Duplication', () => {
      it('should duplicate electrode group with new ID', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: 'tetrode_12.5', location: 'CA1' }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(2);
        expect(result.current.formData.electrode_groups[0].id).toBe(0);
        expect(result.current.formData.electrode_groups[1].id).toBe(1); // max + 1
      });

      it('should preserve all fields except id', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: 'tetrode_12.5', location: 'CA1', description: 'Test' }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const duplicated = result.current.formData.electrode_groups[1];
        expect(duplicated.device_type).toBe('tetrode_12.5');
        expect(duplicated.location).toBe('CA1');
        expect(duplicated.description).toBe('Test');
      });

      it('should insert duplicated electrode group after original', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: 'CA1' },
            { id: 1, device_type: '', location: 'CA3' },
            { id: 2, device_type: '', location: 'DG' }
          ];
        });

        // Duplicate first one (index 0)
        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(4);
        expect(result.current.formData.electrode_groups[0].location).toBe('CA1'); // Original
        expect(result.current.formData.electrode_groups[1].location).toBe('CA1'); // Duplicated
        expect(result.current.formData.electrode_groups[2].location).toBe('CA3');
        expect(result.current.formData.electrode_groups[3].location).toBe('DG');
      });
    });

    describe('ID Increment Logic', () => {
      it('should assign new ID as max existing ID + 1', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' },
            { id: 5, device_type: '', location: '' },
            { id: 3, device_type: '', location: '' }
          ];
        });

        // Duplicate first one (id: 0)
        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const duplicated = result.current.formData.electrode_groups[1];
        expect(duplicated.id).toBe(6); // max(0, 5, 3) + 1 = 6
      });
    });

    describe('Ntrode Map Duplication', () => {
      it('should duplicate associated ntrode maps', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1 } }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes).toHaveLength(2);
      });

      it('should update electrode_group_id on duplicated ntrode maps', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes[0].electrode_group_id).toBe(0); // Original
        expect(ntrodes[1].electrode_group_id).toBe(1); // Duplicated (new electrode group id)
      });

      it('should increment ntrode_id for duplicated ntrode maps', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes[0].ntrode_id).toBe(1); // Original
        expect(ntrodes[1].ntrode_id).toBe(2); // max + 1
      });

      it('should duplicate multiple ntrode maps for multi-shank devices', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: {} },
            { ntrode_id: 2, electrode_group_id: 0, map: {} },
            { ntrode_id: 3, electrode_group_id: 0, map: {} },
            { ntrode_id: 4, electrode_group_id: 0, map: {} }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes).toHaveLength(8); // 4 original + 4 duplicated

        // Check duplicated ntrode IDs are sequential
        expect(ntrodes[4].ntrode_id).toBe(5);
        expect(ntrodes[5].ntrode_id).toBe(6);
        expect(ntrodes[6].ntrode_id).toBe(7);
        expect(ntrodes[7].ntrode_id).toBe(8);
      });

      it('should preserve map objects in duplicated ntrode maps', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
          result.current.formData.ntrode_electrode_group_channel_map = [
            { ntrode_id: 1, electrode_group_id: 0, map: { 0: 0, 1: 1, 2: 2, 3: 3 } }
          ];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        const ntrodes = result.current.formData.ntrode_electrode_group_channel_map;
        expect(ntrodes[1].map).toEqual({ 0: 0, 1: 1, 2: 2, 3: 3 });
      });
    });

    describe('Guard Clauses', () => {
      it('should return early if electrodeGroups is falsy', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = null;
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        // Should not throw error, just return early
        expect(result.current.formData.electrode_groups).toBe(null);
      });

      it('should return early if electrodeGroup at index is falsy', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(0);
      });

      it('should return early if clonedElectrodeGroup is falsy', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [null];
        });

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        expect(result.current.formData.electrode_groups).toHaveLength(1);
      });
    });

    describe('Immutability', () => {
      it('should use structuredClone for immutability', () => {
        const { result } = renderHook(() => useTestHook());

        act(() => {
          result.current.formData.electrode_groups = [
            { id: 0, device_type: '', location: '' }
          ];
        });

        const originalFormData = result.current.formData;

        act(() => {
          result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
        });

        // formData reference should change (new object)
        expect(result.current.formData).not.toBe(originalFormData);
      });
    });
  });
});

/**
 * trodes_to_nwb matches each ntrode in the .rec header to the YAML entry with
 * the same ntrode_id, and takes that entry's electrode group and location. An
 * edit to one electrode group must therefore never change another group's
 * ntrode ids: the shifted hardware channels would be filed under a
 * neighbouring group, and the channel counts would still match.
 */
describe('useElectrodeGroups - other groups keep their ntrode ids', () => {
  /**
   * Holds the form state in React state and edits it through the hook
   *
   * @param {object} initialFormData - The starting form state
   * @returns {object} The form state and the hook's functions
   */
  function useSeededHook(initialFormData) {
    const [formData, setFormData] = useState(initialFormData);
    return { formData, ...useElectrodeGroups(formData, setFormData) };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const groups = (...ids) => ids.map((id) => ({ id, device_type: 'tetrode_12.5', location: 'CA1' }));
  const tetrode = (electrodeGroupId, ntrodeId) => ({
    ntrode_id: ntrodeId,
    electrode_group_id: electrodeGroupId,
    bad_channels: [],
    map: { 0: 0, 1: 1, 2: 2, 3: 3 },
  });
  // [ntrode_id, electrode_group_id] for every ntrode, in array order
  const pairs = (result) =>
    result.current.formData.ntrode_electrode_group_channel_map.map((n) => [
      n.ntrode_id,
      n.electrode_group_id,
    ]);
  const selectDevice = (result, index, deviceType) =>
    act(() => {
      result.current.nTrodeMapSelected(
        { target: { value: deviceType } },
        { key: 'electrode_groups', index }
      );
    });

  it('changing a device type and back leaves every group with its ntrode ids', () => {
    const { result } = renderHook(() =>
      useSeededHook({ electrode_groups: groups(0, 1, 2), ntrode_electrode_group_channel_map: [] })
    );
    selectDevice(result, 0, 'tetrode_12.5');
    selectDevice(result, 1, 'tetrode_12.5');
    selectDevice(result, 2, 'tetrode_12.5');
    expect(pairs(result)).toEqual([[1, 0], [2, 1], [3, 2]]);

    selectDevice(result, 0, '128c-4s6mm6cm-15um-26um-sl');
    expect(pairs(result)).toEqual([[1, 0], [4, 0], [5, 0], [6, 0], [2, 1], [3, 2]]);

    selectDevice(result, 0, 'tetrode_12.5');
    expect(pairs(result)).toEqual([[1, 0], [2, 1], [3, 2]]);
  });

  it('choosing a device type again keeps the group\'s ntrode ids and position', () => {
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: groups(0, 1, 2, 3),
        ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(1, 2), tetrode(2, 3), tetrode(3, 4)],
      })
    );

    selectDevice(result, 1, 'tetrode_12.5');

    expect(pairs(result)).toEqual([[1, 0], [2, 1], [3, 2], [4, 3]]);
  });

  it('a group with fewer shanks keeps its first ntrode ids', () => {
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: groups(0, 1),
        ntrode_electrode_group_channel_map: [
          tetrode(0, 1), tetrode(0, 2), tetrode(0, 3), tetrode(0, 4), tetrode(1, 5),
        ],
      })
    );

    selectDevice(result, 0, '32c-2s8mm6cm-20um-40um-dl');

    expect(pairs(result)).toEqual([[1, 0], [2, 0], [5, 1]]);
  });

  it('never gives the regenerated ntrodes an id another group already uses', () => {
    // e.g. an imported file where two groups share ntrode_id 1
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: groups(0, 1),
        ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(1, 1)],
      })
    );

    selectDevice(result, 0, 'tetrode_12.5');

    expect(pairs(result)).toEqual([[2, 0], [1, 1]]);
  });

  it('Duplicate gives the copy new ntrode ids and changes no other group\'s', () => {
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: groups(0, 1, 2),
        ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(1, 2), tetrode(2, 3)],
      })
    );

    act(() => {
      result.current.duplicateElectrodeGroupItem(0, 'electrode_groups');
    });
    expect(result.current.formData.electrode_groups.map((g) => g.id)).toEqual([0, 3, 1, 2]);
    expect(pairs(result)).toEqual([[1, 0], [2, 1], [3, 2], [4, 3]]);

    selectDevice(result, 0, '32c-2s8mm6cm-20um-40um-dl');
    expect(pairs(result)).toEqual([[1, 0], [5, 0], [2, 1], [3, 2], [4, 3]]);
  });

  it('Remove leaves the other groups\' ntrode ids, also at the next device type change', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: groups(0, 1, 2),
        ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(1, 2), tetrode(2, 3)],
      })
    );

    act(() => {
      result.current.removeElectrodeGroupItem(1, 'electrode_groups');
    });
    expect(pairs(result)).toEqual([[1, 0], [3, 2]]);

    selectDevice(result, 1, 'tetrode_12.5');
    expect(pairs(result)).toEqual([[1, 0], [3, 2]]);
  });
});

/**
 * Channel maps belong to an electrode group through electrode_group_id, so a
 * group's id can only change together with its maps. trodes_to_nwb looks the
 * maps up by group id: maps left on the old id fail the conversion, and maps
 * that end up on another group's id are silently filed under that group.
 */
describe('useElectrodeGroups - changeElectrodeGroupId', () => {
  /**
   * Holds the form state in React state and edits it through the hook
   *
   * @param {object} initialFormData - The starting form state
   * @returns {object} The form state and the hook's functions
   */
  function useSeededHook(initialFormData) {
    const [formData, setFormData] = useState(initialFormData);
    return { formData, ...useElectrodeGroups(formData, setFormData) };
  }

  const group = (id) => ({ id, device_type: 'tetrode_12.5', location: 'CA1' });
  const tetrode = (electrodeGroupId, ntrodeId) => ({
    ntrode_id: ntrodeId,
    electrode_group_id: electrodeGroupId,
    bad_channels: [],
    map: { 0: 0, 1: 1, 2: 2, 3: 3 },
  });
  const twoTetrodes = () => ({
    electrode_groups: [group(0), group(1)],
    ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(1, 2)],
  });
  const groupIds = (result) => result.current.formData.electrode_groups.map((g) => g.id);
  // [ntrode_id, electrode_group_id] for every ntrode, in array order
  const pairs = (result) =>
    result.current.formData.ntrode_electrode_group_channel_map.map((n) => [
      n.ntrode_id,
      n.electrode_group_id,
    ]);
  const changeId = (result, index, value) =>
    act(() => {
      result.current.changeElectrodeGroupId(index, value);
    });

  it('moves the group\'s channel maps to its new id', () => {
    const { result } = renderHook(() => useSeededHook(twoTetrodes()));

    changeId(result, 0, '12');

    expect(groupIds(result)).toEqual([12, 1]);
    expect(pairs(result)).toEqual([[1, 12], [2, 1]]);
  });

  it('swapping two ids through a free one keeps each group\'s channel maps', () => {
    const { result } = renderHook(() => useSeededHook(twoTetrodes()));

    changeId(result, 0, '9');
    changeId(result, 1, '0');
    changeId(result, 0, '1');

    expect(groupIds(result)).toEqual([1, 0]);
    expect(pairs(result)).toEqual([[1, 1], [2, 0]]);
  });

  it('refuses an id another group uses and changes nothing', () => {
    const { result } = renderHook(() => useSeededHook(twoTetrodes()));
    const before = result.current.formData;

    changeId(result, 0, '1');

    expect(result.current.formData).toBe(before);
  });

  it('refuses a value that is not a whole number and changes nothing', () => {
    const { result } = renderHook(() => useSeededHook(twoTetrodes()));
    const before = result.current.formData;

    ['', ' ', '1.5', '-1', 'abc'].forEach((value) => changeId(result, 0, value));

    expect(result.current.formData).toBe(before);
  });

  it('leaves the state alone when the id is unchanged', () => {
    const { result } = renderHook(() => useSeededHook(twoTetrodes()));
    const before = result.current.formData;

    changeId(result, 1, '1');

    expect(result.current.formData).toBe(before);
  });

  it('leaves the channel maps when another group also had the old id', () => {
    // e.g. an imported file where two groups share id 0: whose maps are whose
    // cannot be told, so they stay with the group that keeps the id
    const { result } = renderHook(() =>
      useSeededHook({
        electrode_groups: [group(0), group(0)],
        ntrode_electrode_group_channel_map: [tetrode(0, 1), tetrode(0, 2)],
      })
    );

    changeId(result, 1, '5');

    expect(groupIds(result)).toEqual([0, 5]);
    expect(pairs(result)).toEqual([[1, 0], [2, 0]]);
  });
});

/**
 * Every trodes_to_nwb probe file numbers its electrodes 0..N-1 across the
 * shanks in order. Each shank's ntrode maps its channels 0..n-1 to exactly
 * that shank's electrode ids; a missing id fails the conversion.
 */
describe('useElectrodeGroups - channel maps match the probe files', () => {
  const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const fourShanksOf32 = [range(0, 31), range(32, 63), range(64, 95), range(96, 127)];
  const PROBE_SHANKS = {
    'tetrode_12.5': [range(0, 3)],
    'A1x32-6mm-50-177-H32_21mm': [range(0, 31)],
    '128c-4s4mm6cm-15um-26um-sl': fourShanksOf32,
    '128c-4s4mm6cm-20um-40um-sl': fourShanksOf32,
    '128c-4s6mm6cm-15um-26um-sl': fourShanksOf32,
    '128c-4s6mm6cm-20um-40um-sl': fourShanksOf32,
    '128c-4s8mm6cm-15um-26um-sl': fourShanksOf32,
    '128c-4s8mm6cm-20um-40um-sl': fourShanksOf32,
    '32c-2s8mm6cm-20um-40um-dl': [range(0, 15), range(16, 31)],
    '64c-3s6mm6cm-20um-40um-sl': [range(0, 20), range(21, 41), range(42, 63)],
    '64c-4s6mm6cm-20um-40um-dl': [range(0, 15), range(16, 31), range(32, 47), range(48, 63)],
    'NET-EBL-128ch-single-shank': [range(0, 127)],
  };

  /**
   * Holds a form with one electrode group in React state and edits it through the hook
   *
   * @returns {object} The form state and the hook's functions
   */
  function useSeededHook() {
    const [formData, setFormData] = useState({
      electrode_groups: [{ id: 0, device_type: '', location: 'CA1' }],
      ntrode_electrode_group_channel_map: [],
    });
    return { formData, ...useElectrodeGroups(formData, setFormData) };
  }

  it('covers every device type in the device type list', () => {
    expect(Object.keys(PROBE_SHANKS).sort()).toEqual([...deviceTypes()].sort());
  });

  it.each(Object.entries(PROBE_SHANKS))(
    '%s: one ntrode per shank, mapping its channels to that shank\'s electrode ids',
    (deviceType, shanks) => {
      const { result } = renderHook(() => useSeededHook());

      act(() => {
        result.current.nTrodeMapSelected(
          { target: { value: deviceType } },
          { key: 'electrode_groups', index: 0 }
        );
      });

      const maps = result.current.formData.ntrode_electrode_group_channel_map.map((n) => n.map);
      expect(maps).toEqual(
        shanks.map((electrodeIds) =>
          Object.fromEntries(electrodeIds.map((electrodeId, channel) => [channel, electrodeId]))
        )
      );
    }
  );
});
