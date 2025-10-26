/**
 * Tests for rulesValidation() optogenetics partial metadata detection
 *
 * Critical scientific infrastructure requirement:
 * - If ANY optogenetics field is present, ALL must be present
 * - trodes_to_nwb Python package requires complete optogenetics metadata
 * - Partial metadata will fail downstream conversion
 *
 * Optogenetics fields (all required together):
 * 1. opto_excitation_source - light sources
 * 2. optical_fiber - fiber implants
 * 3. virus_injection - viral vector injections
 * 4. fs_gui_yamls - FsGUI protocol files (optional but recommended)
 *
 * Phase 3, Task 3.1 - Critical test coverage gap identified by code review
 */

import { describe, it, expect } from 'vitest';
import { rulesValidation } from '../../../App';

describe('rulesValidation() - Optogenetics Partial Metadata Detection', () => {
  describe('Partial Optogenetics Configuration (Should Fail)', () => {
    it('should fail when only opto_excitation_source is present', () => {
      const formData = {
        opto_excitation_source: [
          { name: 'Laser1', wavelength_in_nm: 473, power_in_W: 0.1 }
        ],
        optical_fiber: [],
        virus_injection: []
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors).toHaveLength(1);
      expect(result.formErrors[0]).toContain('optogenetics');
      expect(result.formErrors[0]).toContain('Partial optogenetics configuration');
      expect(result.formErrorIds).toContain('opto_excitation_source');
    });

    it('should fail when only optical_fiber is present', () => {
      const formData = {
        opto_excitation_source: [],
        optical_fiber: [
          { name: 'Fiber1', location: 'CA1', ap_in_mm: -3.5 }
        ],
        virus_injection: []
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors).toHaveLength(1);
      expect(result.formErrors[0]).toContain('optogenetics');
      expect(result.formErrorIds).toContain('opto_excitation_source');
    });

    it('should fail when only virus_injection is present', () => {
      const formData = {
        opto_excitation_source: [],
        optical_fiber: [],
        virus_injection: [
          { name: 'AAV1', virus_name: 'AAV2-hSyn-ChR2', volume_in_ul: 0.5 }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors).toHaveLength(1);
      expect(result.formErrors[0]).toContain('optogenetics');
    });

    it('should fail when opto_excitation_source + optical_fiber present but virus_injection missing', () => {
      const formData = {
        opto_excitation_source: [
          { name: 'Laser1', wavelength_in_nm: 473, power_in_W: 0.1 }
        ],
        optical_fiber: [
          { name: 'Fiber1', location: 'CA1', ap_in_mm: -3.5 }
        ],
        virus_injection: [] // Missing!
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors[0]).toContain('Partial optogenetics configuration');
      expect(result.formErrors[0]).toContain('virus_injection');
    });

    it('should fail when opto_excitation_source + virus_injection present but optical_fiber missing', () => {
      const formData = {
        opto_excitation_source: [
          { name: 'Laser1', wavelength_in_nm: 473, power_in_W: 0.1 }
        ],
        optical_fiber: [], // Missing!
        virus_injection: [
          { name: 'AAV1', virus_name: 'AAV2-hSyn-ChR2', volume_in_ul: 0.5 }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors[0]).toContain('Partial optogenetics configuration');
      expect(result.formErrors[0]).toContain('optical_fiber');
    });

    it('should fail when optical_fiber + virus_injection present but opto_excitation_source missing', () => {
      const formData = {
        opto_excitation_source: [], // Missing!
        optical_fiber: [
          { name: 'Fiber1', location: 'CA1', ap_in_mm: -3.5 }
        ],
        virus_injection: [
          { name: 'AAV1', virus_name: 'AAV2-hSyn-ChR2', volume_in_ul: 0.5 }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors[0]).toContain('Partial optogenetics configuration');
      expect(result.formErrors[0]).toContain('opto_excitation_source');
    });

    it('should show which fields are missing in error message', () => {
      const formData = {
        opto_excitation_source: [{ name: 'Laser1' }], // Present
        optical_fiber: [], // Missing
        virus_injection: [] // Missing
      };

      const result = rulesValidation(formData);

      const errorMessage = result.formErrors[0];
      // Error message should indicate which fields are present/missing
      expect(errorMessage).toContain('opto_excitation_source');
      expect(errorMessage).toContain('optical_fiber');
      expect(errorMessage).toContain('virus_injection');
    });
  });

  describe('Complete Optogenetics Configuration (Should Pass)', () => {
    it('should pass when all three optogenetics fields are present', () => {
      const formData = {
        opto_excitation_source: [
          { name: 'Laser1', wavelength_in_nm: 473, power_in_W: 0.1 }
        ],
        optical_fiber: [
          { name: 'Fiber1', location: 'CA1', ap_in_mm: -3.5 }
        ],
        virus_injection: [
          { name: 'AAV1', virus_name: 'AAV2-hSyn-ChR2', volume_in_ul: 0.5 }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toHaveLength(0);
    });

    it('should pass when multiple items in each optogenetics field', () => {
      const formData = {
        opto_excitation_source: [
          { name: 'Laser1', wavelength_in_nm: 473, power_in_W: 0.1 },
          { name: 'Laser2', wavelength_in_nm: 594, power_in_W: 0.15 }
        ],
        optical_fiber: [
          { name: 'Fiber1', location: 'CA1', ap_in_mm: -3.5 },
          { name: 'Fiber2', location: 'CA3', ap_in_mm: -2.8 }
        ],
        virus_injection: [
          { name: 'AAV1', virus_name: 'AAV2-hSyn-ChR2', volume_in_ul: 0.5 },
          { name: 'AAV2', virus_name: 'AAV2-hSyn-eNpHR', volume_in_ul: 0.3 }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toHaveLength(0);
    });

    it('should pass when all optogenetics fields are empty (no optogenetics)', () => {
      const formData = {
        opto_excitation_source: [],
        optical_fiber: [],
        virus_injection: []
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toHaveLength(0);
    });

    it('should pass when optogenetics fields are undefined (default state)', () => {
      const formData = {
        // No optogenetics fields defined
        session_id: 'test_session'
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null arrays as empty', () => {
      const formData = {
        opto_excitation_source: null,
        optical_fiber: null,
        virus_injection: null
      };

      const result = rulesValidation(formData);

      // All null should be treated as empty (no optogenetics)
      expect(result.isFormValid).toBe(true);
    });

    it('should detect partial config when some fields are null', () => {
      const formData = {
        opto_excitation_source: [{ name: 'Laser1' }], // Present
        optical_fiber: null, // Treated as empty
        virus_injection: [] // Empty
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors[0]).toContain('Partial optogenetics configuration');
    });

    it('should handle arrays with one item vs empty arrays differently', () => {
      const formData = {
        opto_excitation_source: [{ name: 'Laser1' }], // Has 1 item
        optical_fiber: [], // Empty
        virus_injection: [] // Empty
      };

      const result = rulesValidation(formData);

      // 1 field present, 2 missing = partial config
      expect(result.isFormValid).toBe(false);
    });
  });

  describe('Integration with Other Validation Rules', () => {
    it('should fail for both optogenetics AND camera/task validation errors', () => {
      const formData = {
        // Optogenetics partial config (should fail)
        opto_excitation_source: [{ name: 'Laser1' }],
        optical_fiber: [],
        virus_injection: [],
        // Camera/task mismatch (should also fail)
        tasks: [{ task_name: 'Sleep', camera_id: 0 }],
        cameras: undefined // Missing cameras
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      // Should have both error types
      expect(result.formErrors.length).toBeGreaterThanOrEqual(2);

      const hasOptoError = result.formErrors.some(err => err.includes('optogenetics'));
      const hasCameraError = result.formErrors.some(err => err.includes('camera'));

      expect(hasOptoError).toBe(true);
      expect(hasCameraError).toBe(true);
    });

    it('should only show optogenetics error when cameras are fine', () => {
      const formData = {
        // Optogenetics partial config
        opto_excitation_source: [{ name: 'Laser1' }],
        optical_fiber: [],
        virus_injection: [],
        // Cameras properly configured
        cameras: [{ id: 0, model: 'Camera1' }],
        tasks: [{ task_name: 'Sleep', camera_id: 0 }]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors).toHaveLength(1);
      expect(result.formErrors[0]).toContain('optogenetics');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should catch incomplete ChR2 experiment setup', () => {
      // Researcher added virus and laser but forgot fiber implant
      const formData = {
        opto_excitation_source: [
          {
            name: 'BlueLaser',
            model_name: 'LaserQuantum Opus',
            wavelength_in_nm: 473,
            power_in_W: 0.1
          }
        ],
        optical_fiber: [], // Forgot to add fiber!
        virus_injection: [
          {
            name: 'ChR2_injection',
            virus_name: 'AAV2-hSyn-ChR2(H134R)-EYFP',
            volume_in_ul: 0.5,
            location: 'CA1'
          }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(false);
      expect(result.formErrors[0]).toContain('optical_fiber');
      expect(result.formErrorIds).toContain('opto_excitation_source');
    });

    it('should allow non-optogenetics experiment (all empty)', () => {
      const formData = {
        session_id: 'sleep_only_session',
        opto_excitation_source: [],
        optical_fiber: [],
        virus_injection: []
        // No tasks or cameras - just testing optogenetics validation
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
    });

    it('should allow complete optogenetics experiment', () => {
      const formData = {
        session_id: 'opto_session_1',
        opto_excitation_source: [
          {
            name: 'BlueLaser',
            wavelength_in_nm: 473,
            power_in_W: 0.1
          }
        ],
        optical_fiber: [
          {
            name: 'OptoFiber1',
            location: 'CA1',
            ap_in_mm: -3.5,
            ml_in_mm: 2.0,
            dv_in_mm: -2.5
          }
        ],
        virus_injection: [
          {
            name: 'ChR2_injection',
            virus_name: 'AAV2-hSyn-ChR2(H134R)-EYFP',
            volume_in_ul: 0.5
          }
        ]
      };

      const result = rulesValidation(formData);

      expect(result.isFormValid).toBe(true);
      expect(result.formErrors).toHaveLength(0);
    });
  });
});
