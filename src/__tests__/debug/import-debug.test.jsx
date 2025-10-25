/**
 * DEBUG TEST - Investigating why subject_id doesn't populate
 *
 * This test adds diagnostic logging to understand data flow
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../../App';

describe('DEBUG: Import subject_id investigation', () => {
  it('logs all form field values after import', async () => {
    // ARRANGE
    const user = userEvent.setup();
    const { container } = render(<App />);

    // Use the ACTUAL minimal-sample.yml content that's known to work
    const minimalYaml = `experimenter_name:
  - Doe, John
lab: Test Lab
institution: Test University
experiment_description: Minimal test conversion
session_description: minimal test session
session_id: "TEST001"
subject:
  description: Test Rat
  genotype: Wild Type
  sex: M
  species: Rattus norvegicus
  subject_id: "RAT001"
  weight: 250
  date_of_birth: "2024-01-01T00:00:00.000Z"
data_acq_device:
  - name: TestDevice
    system: TestSystem
    amplifier: TestAmp
    adc_circuit: TestADC
units:
  analog: "-1"
  behavioral_events: "-1"
times_period_multiplier: 1
raw_data_to_volts: 0.000001
default_header_file_path: header.h
`;

    const yamlFile = new File([minimalYaml], 'test.yml', { type: 'text/yaml' });

    // Mock window.alert to capture validation errors
    const alerts = [];
    global.window.alert = vi.fn((msg) => {
      alerts.push(msg);
      console.log('\n=== ALERT CALLED ===');
      console.log(msg);
      console.log('===================\n');
    });

    // ACT - Upload file
    const fileInput = container.querySelector('#importYAMLFile');
    await user.upload(fileInput, yamlFile);

    // Wait for import to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/^lab$/i)).toHaveValue('Test Lab');
    }, { timeout: 5000 });

    // DIAGNOSTIC: Log all input values
    console.log('\n=== After Import - All Form Values ===');

    const labInput = screen.getByLabelText(/^lab$/i);
    console.log('Lab:', labInput.value);

    const institutionInput = screen.getByLabelText(/institution/i);
    console.log('Institution:', institutionInput.value);

    // Try different ways to find subject_id
    console.log('\n=== Subject ID Field Investigation ===');

    // Method 1: getByLabelText
    try {
      const subjectIdByLabel = screen.getByLabelText(/subject id/i);
      console.log('Found by label text:', subjectIdByLabel.id, 'value:', subjectIdByLabel.value);
    } catch (e) {
      console.log('getByLabelText failed:', e.message);
    }

    // Method 2: getAllByLabelText
    try {
      const subjectIdInputs = screen.getAllByLabelText(/subject id/i);
      console.log('getAllByLabelText found', subjectIdInputs.length, 'inputs');
      subjectIdInputs.forEach((input, i) => {
        console.log(`  Input ${i}: id="${input.id}" name="${input.name}" value="${input.value}"`);
      });
    } catch (e) {
      console.log('getAllByLabelText failed:', e.message);
    }

    // Method 3: Direct querySelector by ID (from App.js line 1105)
    const subjectIdById = container.querySelector('#subject-subjectId');
    if (subjectIdById) {
      console.log('Found by ID (#subject-subjectId):', subjectIdById.value);
    } else {
      console.log('Not found by ID');
    }

    // Method 4: Query by name attribute
    const subjectIdByName = container.querySelector('input[name="subject_id"]');
    if (subjectIdByName) {
      console.log('Found by name (subject_id):', subjectIdByName.value);
    } else {
      console.log('Not found by name');
    }

    // Check species and sex to see if ANY subject fields populate
    try {
      const speciesInput = screen.getByLabelText(/species/i);
      console.log('\nSpecies:', speciesInput.value);
    } catch (e) {
      console.log('\nSpecies not found:', e.message);
    }

    try {
      const sexInput = screen.getByLabelText(/sex/i);
      console.log('Sex:', sexInput.value);
    } catch (e) {
      console.log('Sex not found:', e.message);
    }

    // This test is just for diagnostics - let it pass
    expect(true).toBe(true);
  });
});
