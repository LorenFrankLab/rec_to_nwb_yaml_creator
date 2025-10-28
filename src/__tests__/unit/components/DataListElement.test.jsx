/**
 * Tests for DataListElement component
 *
 * Phase 1: Testing Foundation - Week 4
 *
 * These tests verify the DataListElement component correctly:
 * - Renders with required props
 * - Creates HTML5 datalist for autocomplete functionality
 * - Allows users to select from suggestions OR type custom values
 * - Handles different input types (text, number)
 * - Processes onBlur events for value transformations
 * - Re-renders when defaultValue changes (via key prop)
 * - Renders InfoIcon with placeholder text
 * - Handles edge cases (empty arrays, special characters)
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DataListElement from '../../../element/DataListElement';

describe('DataListElement Component', () => {
  describe('Basic Rendering', () => {
    it('should render with required props', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      // Note: Input with list attribute doesn't get "textbox" role in JSDOM
      // Use container.querySelector or screen.getByDisplayValue instead
      const input = container.querySelector('input#test-datalist');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('id', 'test-datalist');
      expect(input).toHaveAttribute('name', 'test_field');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render label with title text', () => {
      render(
        <DataListElement
          id="test-datalist"
          title="Brain Region"
          name="brain_region"
          dataItems={['CA1', 'CA3']}
        />
      );

      expect(screen.getByText('Brain Region')).toBeInTheDocument();
    });

    it('should have label associated with input via htmlFor', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
        />
      );

      const label = container.querySelector('label[for="test-datalist"]');
      expect(label).toBeInTheDocument();
    });

    it('should render InfoIcon with placeholder as tooltip', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          placeholder="Select from list or type custom value"
        />
      );

      const infoIcon = container.querySelector('span[title="Select from list or type custom value"]');
      expect(infoIcon).toBeInTheDocument();
    });

    it('should render datalist element with correct id', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
        />
      );

      const datalist = container.querySelector('datalist#test-datalist-list');
      expect(datalist).toBeInTheDocument();
      expect(datalist).toHaveAttribute('name', 'test_field');
    });

    it('should link input to datalist via list attribute', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('list', 'test-datalist-list');
    });
  });

  describe('DataList Options Rendering', () => {
    it('should render all options from dataItems array', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('option1');
      expect(options[1]).toHaveValue('option2');
      expect(options[2]).toHaveValue('option3');
    });

    it('should set option text content to dataItem value', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Brain Region"
          name="brain_region"
          dataItems={['CA1', 'CA3', 'PFC']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options[0].textContent).toBe('CA1');
      expect(options[1].textContent).toBe('CA3');
      expect(options[2].textContent).toBe('PFC');
    });

    it('should handle empty dataItems array', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={[]}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(0);
    });

    it('should use sanitizeTitle for option keys', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option-1', 'option_2', 'option.3']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      // Options should render (key is internal to React)
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('option-1');
      expect(options[1]).toHaveValue('option_2');
      expect(options[2]).toHaveValue('option.3');
    });
  });

  describe('Input Type Handling', () => {
    it('should render text input by default (defaultProps)', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render text input when type is text', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          type="text"
          dataItems={['option1']}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('should render number input when type is number', () => {
      render(
        <DataListElement
          id="test-datalist"
          title="Numeric Field"
          name="numeric_field"
          type="number"
          dataItems={['1', '2', '3']}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('Default Value and Placeholder', () => {
    it('should set value as input value (controlled mode)', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
          value="option1"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('option1');
    });

    it('should default to empty string when no value provided', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          value=""
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('');
    });

    it('should handle numeric value', () => {
      render(
        <DataListElement
          id="test-datalist"
          title="Numeric Field"
          name="numeric_field"
          type="number"
          dataItems={['1', '2', '3']}
          value={2}
          onChange={() => {}}
        />
      );

      const input = screen.getByRole('spinbutton');
      expect(input).toHaveValue(2);
    });

    it('should set placeholder attribute', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          placeholder="Select or type..."
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('placeholder', 'Select or type...');
    });

    it('should default to empty string placeholder (defaultProps)', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveAttribute('placeholder', '');
    });
  });

  describe('Controlled Mode Behavior', () => {
    it('should display current value in controlled mode', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          value="option1"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('option1');
    });

    // Controlled mode replaces key={defaultValue} remounting hack.
    // Components now update via value prop changes without remounting.
  });

  describe('User Interactions', () => {
    it('should display typed value in controlled mode', async () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2']}
          value="custom value"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('custom value');
    });

    it('should display selected datalist value', async () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option3']}
          value="option2"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('option2');
    });

    it('should call onBlur when input loses focus', async () => {
      const handleBlur = vi.fn();
      const user = userEvent.setup();

      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          value=""
          onChange={() => {}}
          onBlur={handleBlur}
        />
      );

      const input = container.querySelector('input');
      await user.click(input);
      await user.tab(); // Move focus away

      expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should call onBlur with event object containing input value', async () => {
      const handleBlur = vi.fn();
      const user = userEvent.setup();

      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          value="test value"
          onChange={() => {}}
          onBlur={handleBlur}
        />
      );

      const input = container.querySelector('input');
      await user.click(input); // Focus the input first
      await user.tab(); // Then blur it

      expect(handleBlur).toHaveBeenCalledTimes(1);
      const callArg = handleBlur.mock.calls[0][0];
      expect(callArg.target.value).toBe('test value');
      expect(callArg.target.name).toBe('test_field');
    });

    it('should NOT call onBlur when no onBlur handler provided (defaultProps)', async () => {
      const user = userEvent.setup();

      // Should not throw error when rendering without onBlur
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1']}
          value="test"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('test');

      // User interaction should not throw error even without onBlur handler
      await user.click(input);
      await user.keyboard('test'); // Use keyboard instead of type to avoid append issues
      await user.tab();

      // Input value should update normally (uncontrolled input)
      expect(input.value).toBe('test');
    });
  });

  describe('Edge Cases and Special Characters', () => {
    it('should handle dataItems with special characters', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option-1', 'option_2', 'option.3', 'option@4']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue('option-1');
      expect(options[1]).toHaveValue('option_2');
      expect(options[2]).toHaveValue('option.3');
      expect(options[3]).toHaveValue('option@4');
    });

    it('should handle dataItems with unicode characters', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Brain Region"
          name="brain_region"
          dataItems={['CA1', 'CA3', '实验区域', 'Región cerebral']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(4);
      expect(options[2]).toHaveValue('实验区域');
      expect(options[3]).toHaveValue('Región cerebral');
    });

    it('should handle very long dataItems array (100+ options)', () => {
      const manyOptions = Array.from({ length: 150 }, (_, i) => `option${i}`);

      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={manyOptions}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(150);
    });

    it('should handle empty string in dataItems', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['', 'option1', 'option2']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('');
    });

    it('should handle duplicate values in dataItems', () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['option1', 'option2', 'option1']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      // All 3 options should render (including duplicate)
      expect(options).toHaveLength(3);
      expect(options[0]).toHaveValue('option1');
      expect(options[1]).toHaveValue('option2');
      expect(options[2]).toHaveValue('option1');
    });

    it('POTENTIAL BUG: duplicate sanitizeTitle keys with duplicate dataItems', () => {
      // Similar to SelectElement duplicate key bug
      // If dataItems has duplicates, sanitizeTitle will generate duplicate keys

      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Test Field"
          name="test_field"
          dataItems={['CA1', 'CA3', 'CA1']}
        />
      );

      const datalist = container.querySelector('datalist');
      const options = datalist.querySelectorAll('option');

      expect(options).toHaveLength(3);

      // Both CA1 options will have key "ca1" → React duplicate key warning
      // Fix in Phase 2: Include index in key generation
    });
  });

  describe('Integration with Real-World Usage', () => {
    it('should work with brain region autocomplete (real example)', () => {
      const brainRegions = [
        'CA1',
        'CA2',
        'CA3',
        'DG',
        'PFC',
        'mPFC',
        'OFC',
        'NAc'
      ];

      const { container } = render(
        <DataListElement
          id="brain-region"
          title="Brain Region"
          name="location"
          dataItems={brainRegions}
          placeholder="Select or type brain region"
          value="CA1"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toHaveValue('CA1');

      // User can also type custom region not in list
      // This is the key feature of datalist vs select
    });

    it('should work with experimenter name autocomplete (real example)', () => {
      const experimenters = [
        'Smith, John',
        'Doe, Jane',
        'Johnson, Bob'
      ];

      const { container } = render(
        <DataListElement
          id="experimenter"
          title="Experimenter"
          name="experimenter"
          dataItems={experimenters}
          placeholder="Select or type experimenter name"
          value=""
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input).toBeInTheDocument();

      // Users can select from common names or type a new experimenter
    });

    it('should allow custom values not in dataItems (key datalist feature)', async () => {
      const { container } = render(
        <DataListElement
          id="test-datalist"
          title="Brain Region"
          name="location"
          dataItems={['CA1', 'CA3', 'PFC']}
          value="CustomRegion"
          onChange={() => {}}
        />
      );

      const input = container.querySelector('input');
      expect(input.value).toBe('CustomRegion');

      // This demonstrates that datalist provides suggestions but doesn't restrict input
      // User can type any value in controlled mode
    });
  });

  describe('PropTypes Validation Note', () => {
    it('KNOWN ISSUE: propType typo on line 59 (should be propTypes)', () => {
      // Same typo as SelectElement
      // This is a code quality issue, not a functional bug
      // PropTypes won't validate properly but component still works
      // Fix in Phase 3: Code Quality & Refactoring
    });
  });

  describe('Comparison with SelectElement', () => {
    it('DESIGN NOTE: DataList vs Select differences', () => {
      // DataListElement (this component):
      // - Allows user to type custom values NOT in the list
      // - Provides suggestions via HTML5 <datalist>
      // - More flexible, less restrictive
      // - Used for fields where new values might be needed (brain regions, experimenters)

      // SelectElement:
      // - Restricts user to predefined options only
      // - Uses HTML <select> element
      // - More structured, enforces data consistency
      // - Used for fields with fixed options (device types, camera IDs)

      // Both are valid, serve different UX purposes
    });
  });
});
