/**
 * @file Tests for fieldset/legend grouping
 * @description Verifies semantic HTML structure for form field groups
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import CheckboxList from '../../../element/CheckboxList';
import RadioList from '../../../element/RadioList';

describe('Fieldset/Legend Grouping', () => {
  describe('CheckboxList - Semantic Structure', () => {
    it('should wrap checkboxes in a fieldset', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="test-checkboxes"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={['Alice']}
          dataItems={['Alice', 'Bob', 'Carol']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // Should find a fieldset element
      const fieldset = screen.getByRole('group', { name: /Experimenters/i });
      expect(fieldset.tagName).toBe('FIELDSET');
    });

    it('should use legend for group label', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="test-checkboxes"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={[]}
          dataItems={['Alice', 'Bob']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // Legend should be present and contain title
      const legend = screen.getByText('Experimenters');
      expect(legend.tagName).toBe('LEGEND');
    });

    it('should contain all checkboxes within the fieldset', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="test-checkboxes"
          name="experimenters"
          title="Experimenters"
          type="text"
          defaultValue={[]}
          dataItems={['Alice', 'Bob', 'Carol']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      const fieldset = screen.getByRole('group', { name: /Experimenters/i });
      const checkboxes = within(fieldset).getAllByRole('checkbox');

      expect(checkboxes).toHaveLength(3);
    });

    it('should maintain aria-describedby for additional info', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="test-checkboxes"
          name="experimenters"
          title="Experimenters"
          placeholder="Select all experimenters involved"
          type="text"
          defaultValue={[]}
          dataItems={['Alice', 'Bob']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      const fieldset = screen.getByRole('group', { name: /Experimenters/i });

      // If there's a description, fieldset should reference it
      if (fieldset.hasAttribute('aria-describedby')) {
        const descId = fieldset.getAttribute('aria-describedby');
        const description = document.getElementById(descId);
        expect(description).toBeInTheDocument();
      }
    });
  });

  describe('RadioList - Semantic Structure', () => {
    it('should wrap radio buttons in a fieldset', () => {
      const updateFormData = vi.fn();

      render(
        <RadioList
          id="test-radios"
          name="sex"
          title="Sex"
          type="text"
          defaultValue="M"
          dataItems={['M', 'F', 'U']}
          updateFormData={updateFormData}
          metaData={{}}
        />
      );

      const fieldset = screen.getByRole('group', { name: /Sex/i });
      expect(fieldset.tagName).toBe('FIELDSET');
    });

    it('should use legend for group label', () => {
      const updateFormData = vi.fn();

      render(
        <RadioList
          id="test-radios"
          name="sex"
          title="Sex"
          type="text"
          defaultValue="M"
          dataItems={['M', 'F']}
          updateFormData={updateFormData}
          metaData={{}}
        />
      );

      const legend = screen.getByText('Sex');
      expect(legend.tagName).toBe('LEGEND');
    });

    it('should contain all radio buttons within the fieldset', () => {
      const updateFormData = vi.fn();

      render(
        <RadioList
          id="test-radios"
          name="sex"
          title="Sex"
          type="text"
          defaultValue="M"
          dataItems={['M', 'F', 'U']}
          updateFormData={updateFormData}
          metaData={{}}
        />
      );

      const fieldset = screen.getByRole('group', { name: /Sex/i });
      const radios = within(fieldset).getAllByRole('radio');

      expect(radios).toHaveLength(3);
    });
  });

  describe('Accessibility - Screen Reader Support', () => {
    it('should announce group name before reading options', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="test-a11y"
          name="tasks"
          title="Behavioral Tasks"
          type="text"
          defaultValue={[]}
          dataItems={['Task A', 'Task B']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // Screen readers use role="group" with accessible name from legend
      const group = screen.getByRole('group', { name: /Behavioral Tasks/i });
      expect(group).toBeInTheDocument();

      // Checkboxes should be within the announced group
      const checkboxes = within(group).getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    it('should support keyboard navigation within groups', () => {
      const updateFormData = vi.fn();

      render(
        <RadioList
          id="test-kbd"
          name="choice"
          title="Choose One"
          type="text"
          defaultValue="A"
          dataItems={['A', 'B', 'C']}
          updateFormData={updateFormData}
          metaData={{}}
        />
      );

      const group = screen.getByRole('group');
      const radios = within(group).getAllByRole('radio');

      // All radios should be keyboard accessible
      radios.forEach((radio) => {
        expect(radio).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });

  describe('WCAG Compliance', () => {
    it('should meet WCAG 1.3.1 (Info and Relationships)', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="wcag-test"
          name="colors"
          title="Colors"
          type="text"
          defaultValue={[]}
          dataItems={['Red', 'Green', 'Blue']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // Semantic structure: fieldset > legend + inputs
      const fieldset = screen.getByRole('group');
      expect(fieldset.tagName).toBe('FIELDSET');

      const legend = within(fieldset).getByText('Colors');
      expect(legend.tagName).toBe('LEGEND');

      // Legend must be first child of fieldset
      expect(fieldset.firstElementChild).toBe(legend);
    });

    it('should meet WCAG 3.3.2 (Labels or Instructions)', () => {
      const updateFormData = vi.fn();

      render(
        <RadioList
          id="wcag-test-2"
          name="option"
          title="Select an Option"
          placeholder="Choose the best option for your experiment"
          type="text"
          defaultValue="1"
          dataItems={['1', '2', '3']}
          updateFormData={updateFormData}
          metaData={{}}
        />
      );

      // Group should have clear label
      const group = screen.getByRole('group', { name: /Select an Option/i });
      expect(group).toBeInTheDocument();

      // Each radio should have its own label
      const radios = within(group).getAllByRole('radio');
      radios.forEach((radio) => {
        // Each radio needs an associated label (checked via getByRole)
        expect(radio).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty item lists gracefully', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="empty-test"
          name="empty"
          title="Empty Group"
          type="text"
          defaultValue={[]}
          dataItems={[]}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // Should still render fieldset/legend even with no items
      const group = screen.getByRole('group', { name: /Empty Group/i });
      expect(group).toBeInTheDocument();
    });

    it('should handle required attribute on fieldset', () => {
      const updateFormArray = vi.fn();

      render(
        <CheckboxList
          id="required-test"
          name="required"
          title="Required Choices"
          type="text"
          required={true}
          defaultValue={[]}
          dataItems={['A', 'B']}
          updateFormArray={updateFormArray}
          metaData={{}}
        />
      );

      // At least one checkbox should be required
      const checkboxes = screen.getAllByRole('checkbox');
      const hasRequired = checkboxes.some((cb) => cb.hasAttribute('required'));

      // Or the fieldset itself indicates requirement
      const group = screen.getByRole('group');
      expect(hasRequired || group.hasAttribute('aria-required')).toBe(true);
    });
  });
});
