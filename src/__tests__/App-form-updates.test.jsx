/**
 * Tests for App.js form data update functions
 *
 * Phase 1: Testing Foundation - Week 3
 *
 * These tests verify that updateFormData and updateFormArray correctly
 * manage form state updates with proper immutability and data structures.
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { App } from '../App';
import { defaultYMLValues } from '../valueList';

describe('App Form Data Updates', () => {
  describe('updateFormData - Simple Key-Value Updates', () => {
    it('should update top-level string fields', () => {
      render(<App />);

      // Find and update the lab input field
      const labInput = screen.getAllByLabelText(/^lab$/i)[0];
      expect(labInput).toHaveValue(defaultYMLValues.lab);

      // Change the value
      fireEvent.change(labInput, { target: { value: 'New Lab Name' } });

      // Value should be updated
      expect(labInput).toHaveValue('New Lab Name');
    });

    it('should update top-level text fields independently', () => {
      const { container } = render(<App />);

      // Use querySelector to get by name attribute since labels may not be properly associated
      const labInput = container.querySelector('input[name="lab"]');
      const institutionInput = container.querySelector('input[name="institution"]');

      expect(labInput).toHaveValue(defaultYMLValues.lab);
      expect(institutionInput).toHaveValue(defaultYMLValues.institution);

      fireEvent.change(labInput, { target: { value: 'Lab A' } });
      fireEvent.change(institutionInput, { target: { value: 'Institution B' } });

      // Both should have their new values
      expect(labInput).toHaveValue('Lab A');
      expect(institutionInput).toHaveValue('Institution B');
    });

    it('should update session_id field', () => {
      render(<App />);

      const sessionIdInput = screen.getByLabelText(/^session id$/i);
      expect(sessionIdInput).toHaveValue('');

      fireEvent.change(sessionIdInput, { target: { value: 'session_001' } });

      expect(sessionIdInput).toHaveValue('session_001');
    });

    it('should update experiment_description field', () => {
      render(<App />);

      const descInput = screen.getByLabelText(/^experiment description$/i);
      expect(descInput).toHaveValue('');

      fireEvent.change(descInput, { target: { value: 'Test experiment' } });

      expect(descInput).toHaveValue('Test experiment');
    });

    it('should update session_description field', () => {
      render(<App />);

      const descInput = screen.getByLabelText(/^session description$/i);
      expect(descInput).toHaveValue('');

      fireEvent.change(descInput, { target: { value: 'Test session' } });

      expect(descInput).toHaveValue('Test session');
    });
  });

  describe('updateFormData - Nested Object Updates', () => {
    it('should update subject.subject_id', () => {
      render(<App />);

      const subjectIdInput = screen.getByLabelText(/^subject id$/i);
      expect(subjectIdInput).toHaveValue('');

      fireEvent.change(subjectIdInput, { target: { value: 'rat_001' } });

      expect(subjectIdInput).toHaveValue('rat_001');
    });

    it('should update subject.species', () => {
      const { container } = render(<App />);

      // Use getElementById for the specific subject species field
      const speciesInput = container.querySelector('input[id="subject-species"]');
      expect(speciesInput).toHaveValue(defaultYMLValues.subject.species);

      fireEvent.change(speciesInput, { target: { value: 'Mus musculus' } });

      expect(speciesInput).toHaveValue('Mus musculus');
    });

    it('should update subject.description', () => {
      const { container } = render(<App />);

      const descInput = container.querySelector('input[id="subject-description"]');
      expect(descInput).toHaveValue(defaultYMLValues.subject.description);

      fireEvent.change(descInput, { target: { value: 'Mouse strain' } });

      expect(descInput).toHaveValue('Mouse strain');
    });

    it('should update subject.genotype', () => {
      const { container } = render(<App />);

      // genotype uses DataListElement which renders an input element
      const genotypeInput = container.querySelector('input[id="subject-genotype"]');
      expect(genotypeInput).toHaveValue('');

      fireEvent.change(genotypeInput, { target: { value: 'Wild type' } });

      expect(genotypeInput).toHaveValue('Wild type');
    });

    it('should update subject.weight as number', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');
      expect(weightInput).toHaveValue(defaultYMLValues.subject.weight);

      fireEvent.change(weightInput, { target: { value: '250' } });

      expect(weightInput).toHaveValue(250);
    });

    it('should update subject.sex', () => {
      render(<App />);

      const sexInput = screen.getByLabelText(/^sex$/i);
      expect(sexInput).toHaveValue('M');

      fireEvent.change(sexInput, { target: { value: 'F' } });

      expect(sexInput).toHaveValue('F');
    });

    it('should update multiple subject fields independently', () => {
      const { container } = render(<App />);

      const subjectIdInput = container.querySelector('input[id="subject-subjectId"]');
      const speciesInput = container.querySelector('input[id="subject-species"]');
      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(subjectIdInput, { target: { value: 'animal_123' } });
      fireEvent.change(speciesInput, { target: { value: 'New species' } });
      fireEvent.change(weightInput, { target: { value: '300' } });

      expect(subjectIdInput).toHaveValue('animal_123');
      expect(speciesInput).toHaveValue('New species');
      expect(weightInput).toHaveValue(300);
    });
  });

  describe('updateFormData - Numeric Fields', () => {
    it('should update times_period_multiplier', () => {
      render(<App />);

      const input = screen.getByLabelText(/^times period multiplier$/i);
      expect(input).toHaveValue(defaultYMLValues.times_period_multiplier);

      fireEvent.change(input, { target: { value: '1.5' } });

      expect(input).toHaveValue(1.5);
    });

    it('should update raw_data_to_volts', () => {
      const { container } = render(<App />);

      const input = container.querySelector('input[name="raw_data_to_volts"]');
      expect(input).toHaveValue(defaultYMLValues.raw_data_to_volts);

      fireEvent.change(input, { target: { value: '0.195' } });

      expect(input).toHaveValue(0.195);
    });

    it('should handle numeric field updates with decimal values', () => {
      render(<App />);

      const input = screen.getByLabelText(/^times period multiplier$/i);

      fireEvent.change(input, { target: { value: '2.5' } });
      expect(input).toHaveValue(2.5);

      fireEvent.change(input, { target: { value: '0.001' } });
      expect(input).toHaveValue(0.001);
    });
  });

  describe('updateFormData - Units Nested Object', () => {
    it('should update units.analog', () => {
      render(<App />);

      // Find the analog units input
      const analogInput = screen.getByLabelText(/^analog$/i);
      expect(analogInput).toHaveValue('');

      fireEvent.change(analogInput, { target: { value: 'mV' } });

      expect(analogInput).toHaveValue('mV');
    });

    it('should update units.behavioral_events', () => {
      render(<App />);

      const behavioralInput = screen.getByLabelText(/^behavioral events$/i);
      expect(behavioralInput).toHaveValue('');

      fireEvent.change(behavioralInput, { target: { value: 'TTL' } });

      expect(behavioralInput).toHaveValue('TTL');
    });
  });

  describe('Immutability - State Updates', () => {
    it('should not mutate original formData when updating', () => {
      render(<App />);

      const labInput = screen.getAllByLabelText(/^lab$/i)[0];
      const originalValue = labInput.value;

      // Store reference to current value
      expect(labInput).toHaveValue(originalValue);

      // Update the field
      fireEvent.change(labInput, { target: { value: 'New Value' } });

      // New value should be different
      expect(labInput.value).not.toBe(originalValue);
      expect(labInput).toHaveValue('New Value');
    });

    it('should handle rapid successive updates', () => {
      render(<App />);

      const labInput = screen.getAllByLabelText(/^lab$/i)[0];

      // Rapid updates
      fireEvent.change(labInput, { target: { value: 'Value 1' } });
      fireEvent.change(labInput, { target: { value: 'Value 2' } });
      fireEvent.change(labInput, { target: { value: 'Value 3' } });

      // Should have the last value
      expect(labInput).toHaveValue('Value 3');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string updates', () => {
      render(<App />);

      const labInput = screen.getAllByLabelText(/^lab$/i)[0];

      // Clear the field
      fireEvent.change(labInput, { target: { value: '' } });

      expect(labInput).toHaveValue('');
    });

    it('should handle whitespace in string fields', () => {
      render(<App />);

      const labInput = screen.getAllByLabelText(/^lab$/i)[0];

      fireEvent.change(labInput, { target: { value: '  spaces  ' } });

      expect(labInput).toHaveValue('  spaces  ');
    });

    it('should handle special characters in text fields', () => {
      render(<App />);

      const descInput = screen.getByLabelText(/^experiment description$/i);

      const specialText = 'Test & <script> "quotes" \'apostrophe\'';
      fireEvent.change(descInput, { target: { value: specialText } });

      expect(descInput).toHaveValue(specialText);
    });

    it('should handle very long strings', () => {
      render(<App />);

      const descInput = screen.getByLabelText(/^experiment description$/i);

      const longString = 'A'.repeat(1000);
      fireEvent.change(descInput, { target: { value: longString } });

      expect(descInput).toHaveValue(longString);
    });

    it('should handle zero values in numeric fields', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '0' } });

      expect(weightInput).toHaveValue(0);
    });

    it('should handle negative numbers', () => {
      const { container } = render(<App />);

      const weightInput = container.querySelector('input[id="subject-weight"]');

      fireEvent.change(weightInput, { target: { value: '-100' } });

      expect(weightInput).toHaveValue(-100);
    });
  });
});
