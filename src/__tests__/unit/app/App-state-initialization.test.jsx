/**
 * Tests for App.js state initialization and default values
 *
 * Phase 1: Testing Foundation - Week 3
 *
 * These tests verify that the App component initializes with correct default values
 * and that state management follows expected patterns.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { App } from '../../../App';
import { defaultYMLValues, emptyFormData } from '../../../valueList';

describe('App State Initialization', () => {
  describe('Default State Values', () => {
    it('should have correct default values in defaultYMLValues', () => {
      // Verify core default values
      expect(defaultYMLValues.lab).toBe('Loren Frank Lab');
      expect(defaultYMLValues.institution).toBe('University of California, San Francisco');
      expect(defaultYMLValues.experiment_description).toBe('');
      expect(defaultYMLValues.session_description).toBe('');
      expect(defaultYMLValues.session_id).toBe('');
    });

    it('should have correct default subject values', () => {
      expect(defaultYMLValues.subject.description).toBe('Long-Evans Rat');
      expect(defaultYMLValues.subject.genotype).toBe('');
      expect(defaultYMLValues.subject.sex).toBe('M');
      expect(defaultYMLValues.subject.species).toBe('Rattus norvegicus');
      expect(defaultYMLValues.subject.subject_id).toBe('');
      expect(defaultYMLValues.subject.date_of_birth).toBe('');
      expect(defaultYMLValues.subject.weight).toBe(100);
    });

    it('should have correct default numeric multipliers', () => {
      expect(defaultYMLValues.times_period_multiplier).toBe(1.0);
      expect(defaultYMLValues.raw_data_to_volts).toBe(1.0);
    });

    it('should initialize array fields as empty arrays', () => {
      // These fields start as empty arrays in defaultYMLValues
      expect(defaultYMLValues.experimenter_name).toEqual([]);
      expect(defaultYMLValues.keywords).toEqual([]);
      expect(defaultYMLValues.data_acq_device).toEqual([]);
      expect(defaultYMLValues.cameras).toEqual([]);
      expect(defaultYMLValues.tasks).toEqual([]);
      expect(defaultYMLValues.associated_files).toEqual([]);
      expect(defaultYMLValues.associated_video_files).toEqual([]);
      expect(defaultYMLValues.behavioral_events).toEqual([]);
      expect(defaultYMLValues.electrode_groups).toEqual([]);
      expect(defaultYMLValues.ntrode_electrode_group_channel_map).toEqual([]);
      expect(defaultYMLValues.opto_excitation_source).toEqual([]);
      expect(defaultYMLValues.optical_fiber).toEqual([]);
      expect(defaultYMLValues.virus_injection).toEqual([]);
      expect(defaultYMLValues.fs_gui_yamls).toEqual([]);
    });

    it('should initialize device name with default array', () => {
      expect(defaultYMLValues.device.name).toEqual(['Trodes']);
    });
  });

  describe('Empty Form Data Structure', () => {
    it('should have emptyFormData with cleared values', () => {
      // Verify emptyFormData has empty strings for text fields
      expect(emptyFormData.lab).toBe('');
      expect(emptyFormData.institution).toBe('');
      expect(emptyFormData.experiment_description).toBe('');
      expect(emptyFormData.session_description).toBe('');
      expect(emptyFormData.session_id).toBe('');
    });

    it('should have emptyFormData subject with cleared values', () => {
      expect(emptyFormData.subject.description).toBe('');
      expect(emptyFormData.subject.genotype).toBe('');
      expect(emptyFormData.subject.species).toBe('');
      expect(emptyFormData.subject.subject_id).toBe('');
      expect(emptyFormData.subject.date_of_birth).toBe('');
      expect(emptyFormData.subject.weight).toBe(0);
      // Sex remains 'M' even in empty form
      expect(emptyFormData.subject.sex).toBe('M');
    });

    it('should have emptyFormData with zero numeric values', () => {
      expect(emptyFormData.times_period_multiplier).toBe(0.0);
      expect(emptyFormData.raw_data_to_volts).toBe(0.0);
    });

    it('should have emptyFormData device with empty name array', () => {
      expect(emptyFormData.device.name).toEqual([]);
    });
  });

  describe('State Structure Consistency', () => {
    it('should document key mismatch between defaultYMLValues and emptyFormData', () => {
      const defaultKeys = Object.keys(defaultYMLValues).sort();
      const emptyKeys = Object.keys(emptyFormData).sort();

      // KNOWN BUG: emptyFormData is missing 'optogenetic_stimulation_software'
      // This is a data structure inconsistency that should be fixed in Phase 2
      expect(defaultKeys.length).toBe(26);
      expect(emptyKeys.length).toBe(25);

      // defaultYMLValues has 'optogenetic_stimulation_software' but emptyFormData doesn't
      expect(defaultKeys).toContain('optogenetic_stimulation_software');
      expect(emptyKeys).not.toContain('optogenetic_stimulation_software');

      // Verify other expected keys are present in both
      const commonKeys = ['experimenter_name', 'lab', 'institution', 'subject',
                          'electrode_groups', 'ntrode_electrode_group_channel_map',
                          'opto_excitation_source', 'optical_fiber', 'virus_injection'];

      commonKeys.forEach(key => {
        expect(defaultKeys).toContain(key);
        expect(emptyKeys).toContain(key);
      });
    });

    it('should have matching subject keys between defaultYMLValues and emptyFormData', () => {
      const defaultSubjectKeys = Object.keys(defaultYMLValues.subject).sort();
      const emptySubjectKeys = Object.keys(emptyFormData.subject).sort();

      expect(defaultSubjectKeys).toEqual(emptySubjectKeys);
    });

    it('should have matching units keys between defaultYMLValues and emptyFormData', () => {
      const defaultUnitsKeys = Object.keys(defaultYMLValues.units).sort();
      const emptyUnitsKeys = Object.keys(emptyFormData.units).sort();

      expect(defaultUnitsKeys).toEqual(emptyUnitsKeys);
    });

    it('should have matching device keys between defaultYMLValues and emptyFormData', () => {
      const defaultDeviceKeys = Object.keys(defaultYMLValues.device).sort();
      const emptyDeviceKeys = Object.keys(emptyFormData.device).sort();

      expect(defaultDeviceKeys).toEqual(emptyDeviceKeys);
    });
  });

  describe('Component Rendering', () => {
    it('should render without crashing', () => {
      const { container } = render(<App />);
      expect(container).toBeInTheDocument();
    });

    it('should render form element', () => {
      render(<App />);
      // Should have a form element
      const formElement = document.querySelector('form');
      expect(formElement).toBeInTheDocument();
    });

    it('should render multiple form sections', () => {
      render(<App />);
      // Should have details elements for collapsible sections
      const detailsElements = document.querySelectorAll('details');
      expect(detailsElements.length).toBeGreaterThan(0);
    });

    it('should render input elements', () => {
      render(<App />);
      // Should have multiple input elements
      const inputElements = document.querySelectorAll('input');
      expect(inputElements.length).toBeGreaterThan(10);
    });
  });
});
