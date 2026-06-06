import { describe, it, expect } from 'vitest';
import {
  optoExcitationModelNames,
  opticalFiberModelNames,
  virusNames,
} from '../../valueList';

/**
 * These suggestion lists feed the Optogenetics editor's device-name datalists. The names
 * are EXACT lookup keys into trodes_to_nwb's bundled device metadata (a miss raises a
 * ValueError at conversion), so they are pinned to the bundled catalog identifiers
 * (verified against the trodes_to_nwb optical_source / optical_fiber / virus metadata
 * directories on `main`). The app's own golden sample (20230622_sample_metadata.yml) uses
 * the demo identifiers, so an incomplete list would leave users guessing.
 *
 * Update these only in lockstep with the bundled trodes_to_nwb device metadata.
 */
describe('optogenetics device-name suggestions match the bundled trodes_to_nwb catalog', () => {
  it('excitation source model names', () => {
    expect(optoExcitationModelNames()).toEqual([
      '',
      'Omicron LuxX+ 488-100',
      'LuxX+ 638-200',
    ]);
  });

  it('optical fiber hardware names', () => {
    expect(opticalFiberModelNames()).toEqual([
      '',
      'demo fiber device',
      'optogenix_lambda_fiber',
    ]);
  });

  it('virus names', () => {
    expect(virusNames()).toEqual([
      '',
      'AAV-1-EF1a-DIO-ChRmine-mScarlet-WPRE',
      'AAV-8-EF1a-DIO-ChRmine-mScarlet-WPRE',
      'demo_virus_1',
    ]);
  });

  it('includes the identifiers the checked-in golden sample uses', () => {
    // 20230622_sample_metadata.yml: model_name "Omicron LuxX+ 488-100",
    // hardware_name "demo fiber device", virus_name "demo_virus_1".
    expect(optoExcitationModelNames()).toContain('Omicron LuxX+ 488-100');
    expect(opticalFiberModelNames()).toContain('demo fiber device');
    expect(virusNames()).toContain('demo_virus_1');
  });
});
