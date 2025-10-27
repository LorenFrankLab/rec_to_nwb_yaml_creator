/**
 * Tests for App.js item selection handlers
 *
 * Phase 1: Testing Foundation - Week 3
 *
 * These tests verify that itemSelected correctly handles dropdown/select
 * changes and properly types values (string vs number).
 */

import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../../App';
import { StoreProvider } from '../../../state/StoreContext';
import { defaultYMLValues } from '../../../valueList';
import { getById, getByName } from '../../helpers/test-selectors';

describe('App Item Selection Handlers', () => {
  describe('itemSelected - Simple Selection', () => {
    it('should handle sex selection change', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');
      expect(sexSelect).toHaveValue(defaultYMLValues.subject.sex);

      fireEvent.change(sexSelect, { target: { value: 'F' } });

      expect(sexSelect).toHaveValue('F');
    });

    it('should handle sex selection to different values', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');

      // M -> F
      fireEvent.change(sexSelect, { target: { value: 'F' } });
      expect(sexSelect).toHaveValue('F');

      // F -> U
      fireEvent.change(sexSelect, { target: { value: 'U' } });
      expect(sexSelect).toHaveValue('U');

      // U -> O
      fireEvent.change(sexSelect, { target: { value: 'O' } });
      expect(sexSelect).toHaveValue('O');

      // O -> M
      fireEvent.change(sexSelect, { target: { value: 'M' } });
      expect(sexSelect).toHaveValue('M');
    });

    it('should handle genotype DataList selection', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');
      expect(genotypeInput).toHaveValue('');

      // User selects from datalist
      fireEvent.change(genotypeInput, { target: { value: 'Wild type' } });

      expect(genotypeInput).toHaveValue('Wild type');
    });

    it('should handle species DataList selection', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const speciesInput = getById('subject-species');
      expect(speciesInput).toHaveValue(defaultYMLValues.subject.species);

      fireEvent.change(speciesInput, { target: { value: 'Mus musculus' } });

      expect(speciesInput).toHaveValue('Mus musculus');
    });

    it('should handle lab selection', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const labInput = getByName('lab')[0];
      expect(labInput).toHaveValue(defaultYMLValues.lab);

      fireEvent.change(labInput, { target: { value: 'Different Lab' } });

      expect(labInput).toHaveValue('Different Lab');
    });
  });

  describe('itemSelected - String Values', () => {
    it('should preserve string values from select elements', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');

      fireEvent.change(sexSelect, { target: { value: 'F' } });

      // Value should be string 'F', not parsed
      expect(sexSelect.value).toBe('F');
      expect(typeof sexSelect.value).toBe('string');
    });

    it('should handle empty string selection', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      // User clears selection
      fireEvent.change(genotypeInput, { target: { value: '' } });

      expect(genotypeInput).toHaveValue('');
    });

    it('should preserve special characters in selections', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      const specialValue = 'Type A/B (variant-1)';
      fireEvent.change(genotypeInput, { target: { value: specialValue } });

      expect(genotypeInput).toHaveValue(specialValue);
    });
  });

  describe('itemSelected - Multiple Independent Selections', () => {
    it('should handle multiple field selections independently', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');
      const speciesInput = getById('subject-species');
      const genotypeInput = getById('subject-genotype');

      fireEvent.change(sexSelect, { target: { value: 'F' } });
      fireEvent.change(speciesInput, { target: { value: 'Mus musculus' } });
      fireEvent.change(genotypeInput, { target: { value: 'Wild type' } });

      expect(sexSelect).toHaveValue('F');
      expect(speciesInput).toHaveValue('Mus musculus');
      expect(genotypeInput).toHaveValue('Wild type');
    });

    it('should handle rapid successive selections', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');

      fireEvent.change(sexSelect, { target: { value: 'F' } });
      fireEvent.change(sexSelect, { target: { value: 'U' } });
      fireEvent.change(sexSelect, { target: { value: 'O' } });

      // Should have the last value
      expect(sexSelect).toHaveValue('O');
    });
  });

  describe('itemSelected - Edge Cases', () => {
    it('should handle selection to same value', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');
      const originalValue = sexSelect.value;

      // Select same value
      fireEvent.change(sexSelect, { target: { value: originalValue } });

      expect(sexSelect).toHaveValue(originalValue);
    });

    it('should handle DataList input with custom value', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      // User types custom value not in list
      const customValue = 'Custom Genotype Not In List';
      fireEvent.change(genotypeInput, { target: { value: customValue } });

      expect(genotypeInput).toHaveValue(customValue);
    });

    it('should handle whitespace in selections', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      fireEvent.change(genotypeInput, { target: { value: '  spaced  ' } });

      // itemSelected doesn't trim whitespace
      expect(genotypeInput).toHaveValue('  spaced  ');
    });

    it('should handle numeric strings in text selections', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      // Numeric-looking string should stay as string
      fireEvent.change(genotypeInput, { target: { value: '123' } });

      expect(genotypeInput.value).toBe('123');
      expect(typeof genotypeInput.value).toBe('string');
    });
  });

  describe('itemSelected - Integration with onBlur', () => {
    it('should work correctly when combined with blur events', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const genotypeInput = getById('subject-genotype');

      // Change selection
      fireEvent.change(genotypeInput, { target: { value: 'Wild type' } });
      expect(genotypeInput).toHaveValue('Wild type');

      // Blur event
      fireEvent.blur(genotypeInput);

      // Value should persist after blur
      expect(genotypeInput).toHaveValue('Wild type');
    });

    it('should handle change followed by blur on sex select', () => {
      const { container } = render(
        <StoreProvider>
          <App />
        </StoreProvider>
      );

      const sexSelect = getById('subject-sex');

      fireEvent.change(sexSelect, { target: { value: 'F' } });
      fireEvent.blur(sexSelect);

      expect(sexSelect).toHaveValue('F');
    });
  });
});
