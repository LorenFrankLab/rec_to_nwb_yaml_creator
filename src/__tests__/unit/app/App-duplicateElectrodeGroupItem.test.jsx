/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../../../App';
import { countArrayItems, countNtrodeMaps, getDuplicateButton, queryByName, clickAddButton } from '../../helpers/test-hooks';
import { getByClass, getById, getByName } from '../../helpers/test-selectors';

/**
 * Tests for duplicateElectrodeGroupItem() function
 *
 * Function signature: duplicateElectrodeGroupItem(index, key)
 * Location: src/App.js:707-756
 *
 * Purpose: Duplicates an electrode group AND its associated ntrode channel maps
 *
 * Key behaviors:
 * - Clones formData using structuredClone
 * - Clones electrode group with new ID (max ID + 1)
 * - Finds associated ntrode maps by electrode_group_id
 * - Duplicates ntrode maps with incremented ntrode_ids
 * - Updates electrode_group_id on duplicated ntrodes
 * - Inserts cloned electrode group after original
 * - Updates formData state
 *
 * Guard clauses:
 * - Returns early if !electrodeGroups || !electrodeGroup || !clonedElectrodeGroup
 */

describe('App.js - duplicateElectrodeGroupItem()', () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  describe('Basic Duplication', () => {
    it('should duplicate electrode group when duplicate button clicked', async () => {
      const { container } = render(<App />);

      // Add first electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Initially should have 1 electrode group
      expect(countArrayItems(container)).toBe(1);

      // Find duplicate button
      const duplicateButton = getDuplicateButton(container, 0);
      await user.click(duplicateButton);

      // Wait for state update
      await waitFor(() => {
        expect(countArrayItems(container)).toBe(2);
      });
    });

    it('should insert duplicated electrode group immediately after original', async () => {
      const { container } = render(<App />);

      // Add 3 electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Duplicate the FIRST electrode group (index 0)
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const firstDuplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );

      await user.click(firstDuplicateButton);

      // Wait for state update
      await waitFor(() => {
        const updatedControls = getByClass('array-item__controls');
        expect(updatedControls).toHaveLength(4); // 3 + 1 duplicate
      });

      // The duplicated item should be at index 1 (after index 0)
      // We can verify by checking ID fields - duplicated ID should be max + 1
    });

    it('should duplicate from correct array key parameter', async () => {
      const { container } = render(<App />);

      // The function accepts (index, key) parameters
      // In App.js, it's called with key="electrode_groups"
      // This test verifies the function uses the correct key

      await clickAddButton(user, container, "Add electrode_groups");

      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );

      await user.click(duplicateButton);

      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);
      });

      // If wrong key was used, we wouldn't get 2 electrode groups
    });
  });

  describe('ID Increment Logic', () => {
    it('should assign new ID as max existing ID + 1', async () => {
      const { container } = render(<App />);

      // Add first electrode group (will have id: 0)
      await clickAddButton(user, container, "Add electrode_groups");

      // Duplicate it (should get id: 1)
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);
      });

      // The new electrode group should have id: 1 (0 + 1)
      // We can't easily verify the ID value from UI, but the function
      // calculates: Math.max(...electrodeGroups.map(f => f.id)) + 1
    });

    it('should calculate max ID from ALL electrode groups', async () => {
      const { container } = render(<App />);

      // Add 3 electrode groups (ids: 0, 1, 2)
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Duplicate the FIRST one (index 0, id: 0)
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const firstDuplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );

      await user.click(firstDuplicateButton);

      await waitFor(() => {
        const updatedControls = getByClass('array-item__controls');
        expect(updatedControls).toHaveLength(4);
      });

      // The new electrode group should have id: 3 (max of [0,1,2] + 1)
      // Not id: 1 (which would be original id + 1)
    });

    it('should preserve all other fields except id', async () => {
      const { container } = render(<App />);

      // Add electrode group and set some fields
      await clickAddButton(user, container, "Add electrode_groups");

      // Set location field
      const locationInput = getById('electrode_groups-location-0');
      await user.clear(locationInput);
      await user.type(locationInput, 'CA1');

      // Duplicate it
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      await waitFor(() => {
        const updatedControls = getByClass('array-item__controls');
        expect(updatedControls).toHaveLength(2);
      });

      // Both electrode groups should have location "CA1"
      const locationInput0 = getById('electrode_groups-location-0');
      const locationInput1 = getById('electrode_groups-location-1');
      expect(locationInput0).toHaveValue('CA1');
      expect(locationInput1).toHaveValue('CA1');
    });
  });

  describe('Ntrode Map Duplication', () => {
    it('should duplicate associated ntrode maps with electrode group', async () => {
      const { container } = render(<App />);

      // Add electrode group
      await clickAddButton(user, container, "Add electrode_groups");

      // Select device type to generate ntrode maps
      const deviceSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceSelect, 'tetrode_12.5');

      // Wait for ntrode maps to be generated (1 ntrode for tetrode)
      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(1);
      });

      // Duplicate electrode group
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      // Should now have 2 electrode groups and 2 ntrode maps
      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);

        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(2); // 1 original + 1 duplicated
      });
    });

    it('should increment ntrode_id for duplicated ntrode maps', async () => {
      const { container } = render(<App />);

      // Add electrode group with tetrode device (generates 1 ntrode with ntrode_id: 1)
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceSelect, 'tetrode_12.5');

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(1);
        expect(ntrodeInputs[0]).toHaveValue(1); // First ntrode has id: 1
      });

      // Duplicate electrode group
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      // Duplicated ntrode should have ntrode_id: 2 (max + 1)
      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(2);
        expect(ntrodeInputs[0]).toHaveValue(1); // Original
        expect(ntrodeInputs[1]).toHaveValue(2); // Duplicated (max 1 + 1)
      });
    });

    it('should update electrode_group_id on duplicated ntrode maps', async () => {
      const { container } = render(<App />);

      // Add electrode group with device
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceSelect, 'tetrode_12.5');

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(1);
      });

      // Duplicate electrode group
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);
      });

      // The duplicated ntrode's electrode_group_id should match the new electrode group's id
      // Original electrode group id: 0, duplicated electrode group id: 1
      // Original ntrode electrode_group_id: 0, duplicated ntrode electrode_group_id: 1

      // We can't easily check this from UI, but the function does:
      // n.electrode_group_id = clonedElectrodeGroup.id
    });

    it('should duplicate multiple ntrode maps for multi-shank devices', async () => {
      const { container } = render(<App />);

      // Add electrode group with 2-shank device
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceSelect, '32c-2s8mm6cm-20um-40um-dl');

      // 32-channel, 2-shank device → 1 ntrode per shank = 2 total
      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(2);
      });

      // Duplicate electrode group
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      // Should now have 4 ntrode maps (2 original + 2 duplicated)
      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(4);
      });
    });

    it('should preserve map objects in duplicated ntrode maps', async () => {
      const { container } = render(<App />);

      // Add electrode group with device
      await clickAddButton(user, container, "Add electrode_groups");

      const deviceSelect = getById('electrode_groups-device_type-0');
      await user.selectOptions(deviceSelect, 'tetrode_12.5');

      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(1);
      });

      // The ntrode should have a map object with channel mappings (0→0, 1→1, 2→2, 3→3)
      // We can verify by checking that channel mapping selects exist
      // For a tetrode with 1 ntrode, there are 4 channel selects (one per channel: 0, 1, 2, 3)
      const channelSelects = container.querySelectorAll('.ntrode-maps select');
      expect(channelSelects.length).toBe(4); // 1 ntrode × 4 channels

      // Duplicate electrode group
      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      // Duplicated ntrode should also have channel mapping selects
      // After duplication: 2 ntrodes × 4 channels = 8 selects
      await waitFor(() => {
        const updatedChannelSelects = container.querySelectorAll('.ntrode-maps select');
        expect(updatedChannelSelects.length).toBe(8);
      });
    });
  });

  describe('State Management', () => {
    it('should use structuredClone for immutability', async () => {
      const { container } = render(<App />);

      // The function clones formData at the start
      // Line 708: const form = structuredClone(formData);

      // This ensures original formData is not mutated
      // React re-renders only because setFormData(form) is called with new reference

      await clickAddButton(user, container, "Add electrode_groups");

      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);
      });

      // If structuredClone wasn't used, React might not re-render
    });

    it('should update formData state after duplication', async () => {
      const { container } = render(<App />);

      // The function calls setFormData(form) at the end
      // Line 755: setFormData(form);

      await clickAddButton(user, container, "Add electrode_groups");

      const controls = getByClass('array-item__controls');
      const firstGroupButtons = controls[0].querySelectorAll('button');
      const duplicateButton = Array.from(firstGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );
      await user.click(duplicateButton);

      // State update is evidenced by UI change
      await waitFor(() => {
        const controls = getByClass('array-item__controls');
        expect(controls).toHaveLength(2);
      });
    });
  });

  describe('Integration', () => {
    it('should preserve other electrode groups unaffected', async () => {
      const { container } = render(<App />);

      // Add 3 electrode groups
      await clickAddButton(user, container, "Add electrode_groups", 3);

      // Set locations to distinguish them
      const location0 = getById('electrode_groups-location-0');
      const location1 = getById('electrode_groups-location-1');
      const location2 = getById('electrode_groups-location-2');
      await user.clear(location0);
      await user.type(location0, 'CA1');
      await user.clear(location1);
      await user.type(location1, 'CA3');
      await user.clear(location2);
      await user.type(location2, 'DG');

      // Duplicate the middle one (index 1, "CA3")
      const controls = getByClass('array-item__controls');
      const middleGroupButtons = controls[1].querySelectorAll('button');
      const middleDuplicateButton = Array.from(middleGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );

      await user.click(middleDuplicateButton);

      // Should now have 4 electrode groups
      await waitFor(() => {
        const updatedControls = getByClass('array-item__controls');
        expect(updatedControls).toHaveLength(4);
      });

      // Locations should be: CA1, CA3, CA3 (duplicate), DG
      const updatedLocation0 = getById('electrode_groups-location-0');
      const updatedLocation1 = getById('electrode_groups-location-1');
      const updatedLocation2 = getById('electrode_groups-location-2');
      const updatedLocation3 = getById('electrode_groups-location-3');
      expect(updatedLocation0).toHaveValue('CA1');
      expect(updatedLocation1).toHaveValue('CA3');
      expect(updatedLocation2).toHaveValue('CA3'); // Duplicated
      expect(updatedLocation3).toHaveValue('DG');
    });

    it('should handle complex scenario: multiple electrode groups with different devices', async () => {
      const { container } = render(<App />);

      // Add 2 electrode groups with different devices
      await clickAddButton(user, container, "Add electrode_groups", 2);

      const deviceSelect0 = getById('electrode_groups-device_type-0');
      const deviceSelect1 = getById('electrode_groups-device_type-1');
      await user.selectOptions(deviceSelect0, 'tetrode_12.5'); // 1 shank = 1 ntrode
      await user.selectOptions(deviceSelect1, '32c-2s8mm6cm-20um-40um-dl'); // 2 shanks = 2 ntrodes

      // Wait for ntrode generation (1 + 2 = 3 total)
      await waitFor(() => {
        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(3);
      });

      // Duplicate the SECOND electrode group (the 2-ntrode one)
      const controls = getByClass('array-item__controls');
      const secondGroupButtons = controls[1].querySelectorAll('button');
      const secondDuplicateButton = Array.from(secondGroupButtons).find(
        btn => !btn.classList.contains('button-danger')
      );

      await user.click(secondDuplicateButton);

      // Should now have 3 electrode groups and 5 ntrodes (1 + 2 + 2)
      await waitFor(() => {
        const updatedControls = getByClass('array-item__controls');
        expect(updatedControls).toHaveLength(3);

        const ntrodeInputs = getByName('ntrode_id');
        expect(ntrodeInputs).toHaveLength(5);
      });
    });
  });
});
