/**
 * The downloaded YAML carries both virus-injection volume spellings so it
 * converts with the released trodes_to_nwb (which reads volume_in_uL) without
 * waiting for a converter change, while the schema key volume_in_ul stays
 * canonical and authoritative.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import YAML from 'yaml';
import fs from 'fs';
import path from 'path';
import { exportAll } from '../importExport';

/**
 * The sample metadata as an exportable model whose injections carry only volume_in_ul.
 *
 * @param {number} volume - Volume in microliters to store under volume_in_ul.
 * @returns {object} The model.
 */
function validModelWithVolume(volume) {
  const fixturePath = path.join(__dirname, '../../__tests__/fixtures/valid/20230622_sample_metadata.yml');
  const model = YAML.parse(fs.readFileSync(fixturePath, 'utf8'));
  // The sample uses a placeholder subject id and one relative path for both associated files,
  // which the export gate rejects, so give them real values.
  model.subject.subject_id = 'sample-rat';
  model.associated_files.forEach((file, index) => {
    file.path = `/data/sample/associated${index + 1}.txt`;
  });
  model.virus_injection.forEach((injection) => {
    delete injection.volume_in_uL;
    injection.volume_in_ul = volume;
  });
  return model;
}

describe('exportAll - legacy volume key', () => {
  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:test');
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits both volume spellings with the same value', () => {
    const result = exportAll(validModelWithVolume(450));

    expect(result.validationIssues).toEqual([]);
    expect(result.success).toBe(true);

    const exported = YAML.parse(result.yaml);
    expect(exported.virus_injection[0].volume_in_ul).toBe(450);
    expect(exported.virus_injection[0].volume_in_uL).toBe(450);
  });

  it('leaves the form state untouched', () => {
    const model = validModelWithVolume(450);
    exportAll(model);
    expect(model.virus_injection[0]).not.toHaveProperty('volume_in_uL');
  });
});
