/**
 * Test fixture helpers for integration tests
 *
 * Provides utilities for loading complete, valid YAML fixtures
 * that pass schema validation for import testing.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load the minimal-complete.yml fixture
 * This fixture has ALL required fields to pass validation
 * but is stripped down to minimal arrays for fast testing
 *
 * @returns {string} YAML content
 */
export function getMinimalCompleteYaml() {
  const fixturePath = path.join(__dirname, '../fixtures/valid/minimal-complete.yml');
  return fs.readFileSync(fixturePath, 'utf-8');
}

/**
 * Load minimal-complete.yml and customize specific fields
 * Useful for testing variations without duplicating the entire YAML
 *
 * @param {object} overrides - Fields to override (uses simple string replacement)
 * @returns {string} Customized YAML content
 *
 * @example
 * const yaml = getCustomizedYaml({
 *   lab: 'Custom Lab',
 *   session_id: 'CUSTOM001'
 * });
 */
export function getCustomizedYaml(overrides = {}) {
  let yaml = getMinimalCompleteYaml();

  // Simple string replacement for common fields
  if (overrides.lab) {
    yaml = yaml.replace(/lab: Test Lab/, `lab: ${overrides.lab}`);
  }
  if (overrides.institution) {
    yaml = yaml.replace(/institution: Test University/, `institution: ${overrides.institution}`);
  }
  if (overrides.session_id) {
    yaml = yaml.replace(/session_id: TEST001/, `session_id: ${overrides.session_id}`);
  }
  if (overrides.subject_id) {
    yaml = yaml.replace(/subject_id: RAT001/, `subject_id: ${overrides.subject_id}`);
  }
  if (overrides.experimenter_name) {
    yaml = yaml.replace(/- Doe, John/, `- ${overrides.experimenter_name}`);
  }

  return yaml;
}
