/**
 * @fileoverview Optogenetics device-name suggestion lists (split from the legacy `valueList.js`;
 * re-exported by the `valueList` barrel). Excitation-source, optical-fiber, and virus model names —
 * these mirror EXACT trodes_to_nwb device-metadata lookup keys (a miss raises downstream).
 */

/**
 * List of Optogenetic Excitation Source model name
 *
 * The opto device-name suggestion lists below mirror the EXACT identifiers in
 * trodes_to_nwb's bundled device metadata (the optical_source / optical_fiber / virus
 * metadata directories). These are exact converter lookup keys (a miss raises a
 * ValueError), so the suggestions must match the catalog; a lab using a custom device
 * file can still type a name not listed here.
 *
 * @returns Hardware
 */
export const optoExcitationModelNames = () => {
  return [
    '',
    'Omicron LuxX+ 488-100',
    'LuxX+ 638-200',
  ];
};

export const opticalFiberModelNames = () => {
  return [
    '',
    'demo fiber device',
    'optogenix_lambda_fiber',
  ];
};

export const virusNames = () => {
  return [
    '',
    'AAV-1-EF1a-DIO-ChRmine-mScarlet-WPRE',
    'AAV-8-EF1a-DIO-ChRmine-mScarlet-WPRE',
    'demo_virus_1',
  ];
};
