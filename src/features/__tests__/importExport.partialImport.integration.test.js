import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { importFiles } from '../importExport';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Partial-import correctness, exercised against the REAL validation pipeline (no
 * mocked `validate`). A YAML whose only defect is one camera missing the required
 * `camera_name` must exclude the whole `cameras` section rather than silently import
 * an invalid camera — and the import summary must name both the excluded top-level
 * section (`cameras`) and the nested required path (`cameras[0].camera_name`).
 * @param relativePath
 */
function loadFixtureFile(relativePath) {
  const yaml = fs.readFileSync(path.join(__dirname, relativePath), 'utf-8');
  return new File([yaml], path.basename(relativePath), { type: 'text/yaml' });
}

describe('importFiles partial import (real validation)', () => {
  beforeEach(() => {
    global.window.alert = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('excludes the cameras section when one camera is missing camera_name', async () => {
    const file = loadFixtureFile('../../__tests__/fixtures/invalid/one-invalid-camera.yml');

    const result = await importFiles(file);

    expect(result.success).toBe(true);
    // The invalid camera must NOT be imported: cameras is reset to the empty default.
    expect(result.formData.cameras).toEqual([]);
    // Valid sibling fields still import.
    expect(result.formData.lab).toBe('Test Lab');
    expect(result.formData.institution).toBe('Test University');
  });

  it('returns a clear error for an empty document (YAML.parse → null) instead of throwing', async () => {
    // An empty file parses to null; the partial-import path must not crash on
    // Object.hasOwn(null, key). It should reject cleanly with empty-default form data.
    const file = new File([''], 'empty.yml', { type: 'text/yaml' });

    const result = await importFiles(file);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/metadata|empty|not a valid/i);
    expect(result.formData).toBeTruthy();
    expect(result.formData.cameras).toEqual([]);
  });

  it('rejects a non-object document root (e.g. a YAML list) without throwing', async () => {
    const file = new File(['- one\n- two\n'], 'list.yml', { type: 'text/yaml' });

    const result = await importFiles(file);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/metadata|not a valid/i);
  });

  it('names both the excluded section and the nested required path in the summary', async () => {
    const file = loadFixtureFile('../../__tests__/fixtures/invalid/one-invalid-camera.yml');

    const result = await importFiles(file);

    expect(result.importSummary.hasExclusions).toBe(true);
    const camerasExclusion = result.importSummary.excludedFields.find(
      (entry) => entry.field === 'cameras'
    );
    expect(camerasExclusion).toBeDefined();
    // The nested path is carried so the user sees exactly which camera field is at fault.
    expect(camerasExclusion.paths).toContain('cameras[0].camera_name');
  });
});
