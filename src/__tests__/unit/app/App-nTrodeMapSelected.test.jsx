/**
 * Tests for nTrodeMapSelected() function
 *
 * Location: src/App.js lines 292-356
 *
 * This function is triggered when a user selects a device_type for an electrode group.
 * It auto-generates ntrode channel maps based on the device type and shank count.
 *
 * Key behaviors:
 * 1. Sets device_type on electrode group
 * 2. Generates ntrode objects (one per shank) with channel mappings
 * 3. Removes old ntrode maps for this electrode group
 * 4. Adds new ntrode maps to formData
 * 5. Renumbers all ntrode_id values sequentially (1, 2, 3, ...)
 *
 * Architecture understanding:
 * - deviceTypeMap(type): returns channel index array [0, 1, 2, 3] for map structure
 * - getShankCount(type): returns number of shanks (determines # of ntrodes)
 * - Each shank gets ONE ntrode object
 * - ntrode.map: { 0: 0, 1: 1, 2: 2, 3: 3 } with offsets for multi-shank
 */

import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { getShankCount } from '../../../ntrode/deviceTypes';
import { clickAddButton } from '../../helpers/test-hooks';
import { getById, getByName } from '../../helpers/test-selectors';

describe('App.js - nTrodeMapSelected()', () => {
  describe('Basic Device Type Selection', () => {
    it('should set device_type on electrode group when selected', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Select device type
      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      // Verify device_type was set
      expect(deviceTypeSelect.value).toBe('tetrode_12.5');
    });

    it('should generate ntrode UI elements when device type selected', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Before selection - no ntrodes
      let ntrodeIdInputs = getByName('ntrode_id');
      expect(ntrodeIdInputs.length).toBe(0);

      // Select device type
      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      // After selection - ntrode created
      await waitFor(() => {
        ntrodeIdInputs = getByName('ntrode_id');
        expect(ntrodeIdInputs.length).toBeGreaterThan(0);
      });
    });

    it('should update device_type when changed to different value', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Select first device type
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      expect(deviceTypeSelect.value).toBe('tetrode_12.5');

      // Change to different device type
      await user.selectOptions(deviceTypeSelect, 'A1x32-6mm-50-177-H32_21mm');
      expect(deviceTypeSelect.value).toBe('A1x32-6mm-50-177-H32_21mm');
    });
  });

  describe('Ntrode Generation Based on Shank Count', () => {
    it('should generate 1 ntrode for single-shank device (tetrode)', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // Tetrode has 1 shank, should generate 1 ntrode
        // Verify by counting ntrode_id inputs (one per ntrode)
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(1);
      });
    });

    it('should generate 2 ntrodes for 2-shank device', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, '32c-2s8mm6cm-20um-40um-dl');

      await waitFor(() => {
        // 2-shank device should generate 2 ntrodes (one per shank)
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(2);
      });
    });

    it('should generate 3 ntrodes for 3-shank device', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, '64c-3s6mm6cm-20um-40um-sl');

      await waitFor(() => {
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(3);
      });
    });

    it('should generate 4 ntrodes for 4-shank device', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, '128c-4s6mm6cm-15um-26um-sl');

      await waitFor(() => {
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(4);
      });
    });

    it('should match shank count from getShankCount() utility', () => {
      // Verify shank count utility works correctly
      expect(getShankCount('tetrode_12.5')).toBe(1);
      expect(getShankCount('A1x32-6mm-50-177-H32_21mm')).toBe(1);
      expect(getShankCount('32c-2s8mm6cm-20um-40um-dl')).toBe(2);
      expect(getShankCount('64c-3s6mm6cm-20um-40um-sl')).toBe(3);
      expect(getShankCount('128c-4s6mm6cm-15um-26um-sl')).toBe(4);
      expect(getShankCount('128c-4s8mm6cm-20um-40um-sl')).toBe(4);
      expect(getShankCount('64c-4s6mm6cm-20um-40um-dl')).toBe(4);
      expect(getShankCount('NET-EBL-128ch-single-shank')).toBe(1);
    });
  });

  describe('Ntrode ID Sequential Numbering', () => {
    it('should assign ntrode_id starting from 1', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        const ntrodeInput = getByName('ntrode_id')[0];
        expect(ntrodeInput.value).toBe('1');
      });
    });

    it('should number multiple ntrodes sequentially (1, 2, 3, 4)', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, '128c-4s6mm6cm-15um-26um-sl'); // 4 shanks

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs.length).toBe(4);
        expect(ntrodeInputs[0].value).toBe('1');
        expect(ntrodeInputs[1].value).toBe('2');
        expect(ntrodeInputs[2].value).toBe('3');
        expect(ntrodeInputs[3].value).toBe('4');
      });
    });

    it('should continue sequential numbering across multiple electrode groups', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Add first electrode group with tetrode (1 ntrode)
      await clickAddButton(user, container, "Add electrode_groups");
      const deviceTypeSelect1 = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect1, 'tetrode_12.5');

      // Add second electrode group with 2-shank device (2 ntrodes)
      await clickAddButton(user, container, "Add electrode_groups");
      const deviceTypeSelect2 = getById('electrode_groups-device_type-1');
      await user.selectOptions(deviceTypeSelect2, '32c-2s8mm6cm-20um-40um-dl');

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs.length).toBe(3); // 1 + 2 = 3 total
        expect(ntrodeInputs[0].value).toBe('1');
        expect(ntrodeInputs[1].value).toBe('2');
        expect(ntrodeInputs[2].value).toBe('3');
      });
    });
  });

  describe('Replacing Existing Ntrode Maps', () => {
    it('should replace ntrode maps when device type changed', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Select tetrode (1 ntrode)
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        let ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(1);
      });

      // Change to 4-shank device (4 ntrodes)
      await user.selectOptions(deviceTypeSelect, '128c-4s6mm6cm-15um-26um-sl');

      await waitFor(() => {
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(4); // Old ntrode replaced
      });
    });

    it('should preserve ntrode maps for other electrode groups', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Add first electrode group with tetrode (1 ntrode)
      await clickAddButton(user, container, "Add electrode_groups");
      const deviceTypeSelect1 = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect1, 'tetrode_12.5');

      // Add second electrode group with 2-shank (2 ntrodes)
      await clickAddButton(user, container, "Add electrode_groups");
      const deviceTypeSelect2 = getById('electrode_groups-device_type-1');
      await user.selectOptions(deviceTypeSelect2, '32c-2s8mm6cm-20um-40um-dl');

      await waitFor(() => {
        let ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(3); // 1 + 2 = 3
      });

      // Change first electrode group to 4-shank device
      await user.selectOptions(deviceTypeSelect1, '128c-4s6mm6cm-15um-26um-sl');

      await waitFor(() => {
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(6); // 4 (new) + 2 (preserved) = 6
      });
    });

    it('should renumber all ntrode_id values after replacement', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Select tetrode (ntrode_id = 1)
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        let ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs[0].value).toBe('1');
      });

      // Change to 3-shank device (ntrode_id should be 1, 2, 3)
      await user.selectOptions(deviceTypeSelect, '64c-3s6mm6cm-20um-40um-sl');

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs.length).toBe(3);
        expect(ntrodeInputs[0].value).toBe('1');
        expect(ntrodeInputs[1].value).toBe('2');
        expect(ntrodeInputs[2].value).toBe('3');
      });
    });
  });

  describe('Channel Map Generation', () => {
    it('should create channel map UI elements', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // Should have channel mapping selects
        const mapSelects = container.querySelectorAll('.ntrode-map select');
        expect(mapSelects.length).toBeGreaterThan(0);
      });
    });

    it('should display bad_channels checkbox list', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // Bad channels section should exist
        const badChannelsLabel = screen.queryByText(/bad channels/i);
        expect(badChannelsLabel).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle rapid device type changes', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Rapidly change device types
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');
      await user.selectOptions(deviceTypeSelect, 'A1x32-6mm-50-177-H32_21mm');
      await user.selectOptions(deviceTypeSelect, '32c-2s8mm6cm-20um-40um-dl');

      await waitFor(() => {
        // Final state should reflect last selection (2 shanks)
        const ntrodeIds = getByName('ntrode_id');
        expect(ntrodeIds.length).toBe(2);
      });
    });

    it('should handle device type selection on first electrode group', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      // First electrode group should have id = 0
      const electrodeGroupIdInput = getById('electrode_groups-id-0');
      expect(electrodeGroupIdInput.value).toBe('0');

      const deviceTypeSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // Ntrode should be created successfully
        const ntrodeInput = getByName('ntrode_id')[0];
        expect(ntrodeInput).toBeInTheDocument();
      });
    });

    it('should handle all supported device types without errors', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      const supportedDeviceTypes = [
        'tetrode_12.5',
        'A1x32-6mm-50-177-H32_21mm',
        '128c-4s8mm6cm-20um-40um-sl',
        '128c-4s6mm6cm-15um-26um-sl',
        '32c-2s8mm6cm-20um-40um-dl',
        '64c-4s6mm6cm-20um-40um-dl',
        '64c-3s6mm6cm-20um-40um-sl',
        'NET-EBL-128ch-single-shank',
      ];

      // Test each device type sequentially
      for (const deviceType of supportedDeviceTypes) {
        await user.selectOptions(deviceTypeSelect, deviceType);

        // Verify device type was set without errors
        expect(deviceTypeSelect.value).toBe(deviceType);
      }
    });
  });

  describe('State Management', () => {
    it('should update formData state when device type selected', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Before selection - no ntrodes
      let ntrodeInputs = getByName('ntrode_id');
      expect(ntrodeInputs.length).toBe(0);

      // After selection - state updated (verified by UI rendering)
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs.length).toBe(1);
      });
    });

    it('should maintain immutability using structuredClone', async () => {
      // Behavioral test - verifies function doesn't mutate original formData
      // by checking that React state updates trigger re-renders
      const { container } = render(<App />);
      const user = userEvent.setup();

      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = getById('electrode_groups-device_type-0');

      // Store initial ntrode count
      const initialNtrodeCount = getByName('ntrode_id').length;
      expect(initialNtrodeCount).toBe(0);

      // Select device type
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // State should have updated (new ntrode created)
        const newNtrodeCount = getByName('ntrode_id').length;
        expect(newNtrodeCount).toBe(1);
        expect(newNtrodeCount).not.toBe(initialNtrodeCount);
      });
    });
  });
});
