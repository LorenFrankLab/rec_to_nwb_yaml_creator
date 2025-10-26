/**
 * Tests for Phase 2 Bug Fix: Duplicate React Keys
 *
 * Bug: Components using array.map() generate duplicate keys when:
 * - dataItems array contains duplicate values
 * - Different values sanitize to the same string
 *
 * Components affected:
 * - SelectElement
 * - CheckboxList
 * - RadioList
 * - DataListElement
 * - ChannelMap
 *
 * Fix: Include index in key generation to ensure uniqueness
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SelectElement from '../../../element/SelectElement';
import CheckboxList from '../../../element/CheckboxList';
import RadioList from '../../../element/RadioList';
import DataListElement from '../../../element/DataListElement';
import ListElement from '../../../element/ListElement';
import ChannelMap from '../../../ntrode/ChannelMap';
import { getMainForm, getFileInput } from '../../helpers/test-selectors';

describe('Duplicate React Keys Fix', () => {
  describe('SelectElement', () => {
    it('should generate unique keys for duplicate dataItems', () => {
      // ARRANGE
      const duplicateItems = ['CA1', 'CA1', 'CA2'];
      const consoleWarnSpy = vi.spyOn(console, 'error');

      // ACT
      render(
        <SelectElement
          id="test-select"
          name="test"
          title="Test Select"
          type="text"
          dataItems={duplicateItems}
        />
      );

      // ASSERT
      const options = screen.getAllByRole('option');
      // Should have 3 options (all CA1 duplicates should render)
      expect(options).toHaveLength(3);

      // Should NOT have React duplicate key warning
      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });

    it('should generate unique keys when different items sanitize to same value', () => {
      // ARRANGE
      const items = ['CA-1', 'CA_1', 'CA 1']; // All sanitize to 'ca1'
      const consoleWarnSpy = vi.spyOn(console, 'error');

      // ACT
      render(
        <SelectElement
          id="test-select"
          name="test"
          title="Test Select"
          type="text"
          dataItems={items}
        />
      );

      // ASSERT
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(3);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('CheckboxList', () => {
    it('should generate unique keys for duplicate dataItems', () => {
      // ARRANGE
      const duplicateItems = ['1', '1', '2'];
      const consoleWarnSpy = vi.spyOn(console, 'error');
      const mockUpdateFormArray = vi.fn();

      // ACT
      render(
        <CheckboxList
          id="test-checkbox"
          name="test"
          title="Test Checkbox"
          type="number"
          dataItems={duplicateItems}
          defaultValue={[]}
          updateFormArray={mockUpdateFormArray}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(3);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('RadioList', () => {
    it('should generate unique keys for duplicate dataItems', () => {
      // ARRANGE
      const duplicateItems = ['1', '1', '2'];
      const consoleWarnSpy = vi.spyOn(console, 'error');
      const mockUpdateFormData = vi.fn();

      // ACT
      render(
        <RadioList
          id="test-radio"
          name="test"
          title="Test Radio"
          type="number"
          dataItems={duplicateItems}
          defaultValue="1"
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT
      const radios = screen.getAllByRole('radio');
      expect(radios).toHaveLength(3);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('DataListElement', () => {
    it('should generate unique keys for duplicate dataItems', () => {
      // ARRANGE
      const duplicateItems = ['CA1', 'CA1', 'CA2'];
      const consoleWarnSpy = vi.spyOn(console, 'error');

      // ACT
      const { container } = render(
        <DataListElement
          id="test-datalist"
          name="test"
          title="Test DataList"
          type="text"
          dataItems={duplicateItems}
        />
      );

      // ASSERT
      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');
      expect(options).toHaveLength(3);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('ListElement', () => {
    it('should generate unique keys for duplicate defaultValue items', () => {
      // ARRANGE
      const duplicateItems = ['value1', 'value1', 'value2'];
      const consoleWarnSpy = vi.spyOn(console, 'error');
      const mockUpdateFormData = vi.fn();

      // ACT
      render(
        <ListElement
          id="test-list"
          name="test"
          title="Test List"
          type="text"
          defaultValue={duplicateItems}
          updateFormData={mockUpdateFormData}
          metaData={{ nameValue: 'test', keyValue: 'test', index: 0 }}
        />
      );

      // ASSERT
      // Should render all 3 items (including duplicate)
      const container = screen.getByText('Test List').closest('.container');
      expect(container).toBeTruthy();

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });

  describe('ChannelMap', () => {
    it('should generate unique keys for multiple nTrode items', () => {
      // ARRANGE
      const nTrodeItems = [
        {
          ntrode_id: 1,
          electrode_group_id: 1,
          bad_channels: [],
          map: { 0: 0, 1: 1, 2: 2, 3: 3 }
        },
        {
          ntrode_id: 2,
          electrode_group_id: 1,
          bad_channels: [],
          map: { 0: 4, 1: 5, 2: 6, 3: 7 }
        }
      ];
      const consoleWarnSpy = vi.spyOn(console, 'error');
      const mockOnBlur = vi.fn();
      const mockOnMapInput = vi.fn();
      const mockUpdateFormArray = vi.fn();

      // ACT
      render(
        <ChannelMap
          nTrodeItems={nTrodeItems}
          onBlur={mockOnBlur}
          onMapInput={mockOnMapInput}
          electrodeGroupId={1}
          updateFormArray={mockUpdateFormArray}
          metaData={{ index: 0 }}
        />
      );

      // ASSERT
      const fieldsets = screen.getAllByRole('group');
      // Each shank has 1 fieldset (for shank) + 1 fieldset (for bad_channels CheckboxList) = 2 per shank
      // 2 shanks × 2 fieldsets = 4 total
      expect(fieldsets).toHaveLength(4);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });

    it('should generate unique keys for channel map options', () => {
      // ARRANGE
      const nTrodeItems = [
        {
          ntrode_id: 1,
          electrode_group_id: 1,
          bad_channels: [],
          map: { 0: 0, 1: 1, 2: 2, 3: 3 }
        }
      ];
      const consoleWarnSpy = vi.spyOn(console, 'error');

      // ACT
      const { container } = render(
        <ChannelMap
          nTrodeItems={nTrodeItems}
          onBlur={vi.fn()}
          onMapInput={vi.fn()}
          electrodeGroupId={1}
          updateFormArray={vi.fn()}
          metaData={{ index: 0 }}
        />
      );

      // ASSERT
      const selects = container.querySelectorAll('.ntrode-map select');
      expect(selects.length).toBeGreaterThan(0);

      const duplicateKeyWarnings = consoleWarnSpy.mock.calls.filter(call =>
        call[0]?.toString().includes('Encountered two children with the same key')
      );
      expect(duplicateKeyWarnings).toHaveLength(0);

      consoleWarnSpy.mockRestore();
    });
  });
});
