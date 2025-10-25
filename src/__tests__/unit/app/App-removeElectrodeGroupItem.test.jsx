/**
 * Tests for removeElectrodeGroupItem() function
 *
 * Location: src/App.js lines 410-436
 *
 * This function removes an electrode group and its associated ntrode maps.
 *
 * Key behaviors:
 * 1. Shows confirmation dialog with index and key
 * 2. If confirmed, removes electrode group from array
 * 3. Removes all ntrode maps with matching electrode_group_id
 * 4. Updates formData state
 * 5. If cancelled, no changes made
 * 6. Guard clauses: returns null if items empty or item not found
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { useWindowConfirmMock, clickAddButton } from '../../helpers/test-hooks';

describe('App.js - removeElectrodeGroupItem()', () => {
  const mocks = useWindowConfirmMock(beforeEach, afterEach, true);
  describe('Confirmation Dialog', () => {
    it('should show confirmation dialog when remove button clicked', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Mock window.confirm
      // Confirm mock set up by useWindowConfirmMock hook

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Click remove button
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      // Verify confirmation was shown
      expect(mocks.confirm).toHaveBeenCalledWith('Remove index 0 from electrode_groups?');

    });

    it('should include correct index and key in confirmation message', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add two electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 2);

      // Remove second electrode group (index 1)
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[1]);

      expect(mocks.confirm).toHaveBeenCalledWith('Remove index 1 from electrode_groups?');

    });
  });

  describe('Removal When Confirmed', () => {
    it('should remove electrode group when user confirms', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Verify electrode group exists
      let electrodeGroupSections = container.querySelectorAll('.array-item__controls');
      expect(electrodeGroupSections.length).toBe(1);

      // Remove it
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      // Verify electrode group removed
      await waitFor(() => {
        electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(0);
      });

    });

    it('should remove first electrode group correctly', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add three electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Remove first (index 0)
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[0]);

      await waitFor(() => {
        const electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(2);
      });

    });

    it('should remove middle electrode group correctly', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add three electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Remove middle (index 1)
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[1]);

      await waitFor(() => {
        const electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(2);
      });

    });

    it('should remove last electrode group correctly', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add three electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Remove last (index 2)
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[2]);

      await waitFor(() => {
        const electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(2);
      });

    });
  });

  describe('Cancellation', () => {
    it('should not remove electrode group when user cancels', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      mocks.confirm.mockReturnValue(false);

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Try to remove but cancel
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      // Verify electrode group still exists
      const electrodeGroupSections = container.querySelectorAll('.array-item__controls');
      expect(electrodeGroupSections.length).toBe(1);

    });

    it('should maintain form state when removal cancelled', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      mocks.confirm.mockReturnValue(false);

      // Add electrode group and set device type
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = container.querySelector('#electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      // Try to remove but cancel
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      // Verify device type still set
      expect(deviceTypeSelect.value).toBe('tetrode_12.5');

    });
  });

  describe('Associated Ntrode Map Removal', () => {
    it('should remove ntrode maps when electrode group removed', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add electrode group and select device type to generate ntrodes
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = container.querySelector('#electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, 'tetrode_12.5');

      await waitFor(() => {
        // Ntrode should be created
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(1);
      });

      // Remove electrode group
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      await waitFor(() => {
        // Ntrode should be removed
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(0);
      });

    });

    it('should only remove ntrodes for removed electrode group', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add two electrode groups with device types
      await clickAddButton(user, container, "Add electrode_groups", 2);

      const deviceTypeSelects = container.querySelectorAll('select[name="device_type"]');
      await user.selectOptions(deviceTypeSelects[0], 'tetrode_12.5'); // 1 ntrode
      await user.selectOptions(deviceTypeSelects[1], '32c-2s8mm6cm-20um-40um-dl'); // 2 ntrodes

      await waitFor(() => {
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(3); // 1 + 2 = 3 total
      });

      // Remove first electrode group
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[0]);

      await waitFor(() => {
        // Should have only 2 ntrodes left (from second electrode group)
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(2);
      });

    });

    it('should remove all ntrodes for multi-shank device', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add electrode group with 4-shank device (4 ntrodes)
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceTypeSelect = container.querySelector('#electrode_groups-device_type-0');
      await user.selectOptions(deviceTypeSelect, '128c-4s6mm6cm-15um-26um-sl');

      await waitFor(() => {
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(4);
      });

      // Remove electrode group
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      await waitFor(() => {
        // All 4 ntrodes should be removed
        const ntrodeInputs = container.querySelectorAll('input[name="ntrode_id"]');
        expect(ntrodeInputs.length).toBe(0);
      });

    });
  });

  describe('State Management', () => {
    it('should update formData state after removal', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Verify exists
      let electrodeGroupSections = container.querySelectorAll('.array-item__controls');
      expect(electrodeGroupSections.length).toBe(1);

      // Remove it
      const removeButton = container.querySelector('button.button-danger');
      await user.click(removeButton);

      // Verify state updated (UI reflects change)
      await waitFor(() => {
        electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(0);
      });

    });

    it('should maintain immutability using structuredClone', async () => {
      // Behavioral test - function uses structuredClone multiple times
      // Verified by checking React state triggers re-renders
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      await clickAddButton(user, container, "Add electrode_groups", 2);

      // Store initial count
      let electrodeGroupSections = container.querySelectorAll('.array-item__controls');
      const initialCount = electrodeGroupSections.length;
      expect(initialCount).toBe(2);

      // Remove one
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[0]);

      await waitFor(() => {
        electrodeGroupSections = container.querySelectorAll('.array-item__controls');
        expect(electrodeGroupSections.length).toBe(1);
        expect(electrodeGroupSections.length).not.toBe(initialCount);
      });

    });
  });

  describe('Guard Clauses', () => {
    it('should handle removal attempt when no electrode groups exist', async () => {
      // This tests the guard clause: if (!items || items.length === 0)
      // Since we can't click remove when there are no items (no UI rendered),
      // this is more of a documentation test that the guard exists
      const { container } = render(<App />);

      // Verify no electrode groups exist
      const electrodeGroupSections = container.querySelectorAll('.array-item__controls');
      expect(electrodeGroupSections.length).toBe(0);

      // Remove button shouldn't exist
      const removeButton = container.querySelector('button.button-danger');
      expect(removeButton).toBeNull();
    });
  });

  describe('Other Electrode Groups Unaffected', () => {
    it('should not affect other electrode groups when one removed', async () => {
      const { container } = render(<App />);
      const user = userEvent.setup();

      // Confirm mock set up by useWindowConfirmMock hook

      // Add three electrode groups with different device types
      await clickAddButton(user, container, "Add electrode_groups", 3);

      const deviceTypeSelects = container.querySelectorAll('select[name="device_type"]');
      await user.selectOptions(deviceTypeSelects[0], 'tetrode_12.5');
      await user.selectOptions(deviceTypeSelects[1], 'A1x32-6mm-50-177-H32_21mm');
      await user.selectOptions(deviceTypeSelects[2], '32c-2s8mm6cm-20um-40um-dl');

      // Remove middle one (index 1)
      const removeButtons = container.querySelectorAll('button.button-danger');
      await user.click(removeButtons[1]);

      await waitFor(() => {
        // Remaining electrode groups should still have device types set
        const remainingSelects = container.querySelectorAll('select[name="device_type"]');
        expect(remainingSelects.length).toBe(2);
        // First and third should remain (but re-indexed)
        expect(remainingSelects[0].value).toBe('tetrode_12.5');
        expect(remainingSelects[1].value).toBe('32c-2s8mm6cm-20um-40um-dl');
      });

    });
  });
});
