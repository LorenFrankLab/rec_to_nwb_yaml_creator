/**
 * @fileoverview Recording-hardware catalogs (split from the legacy `valueList.js`; re-exported by
 * the `valueList` barrel). Device names, data-acquisition device fields, camera manufacturers,
 * probe/device types + their display labels, and measurement units.
 */

/**
 * List of device-
 *
 * @returns Devices
 */
export const device = () => {
  return [...['Trodes', 'Tetrode', 'Blackrock']];
};

/**
 * Data Acquisition Device Name
 *
 * @returns New name object
 */
export const dataAcqDeviceName = () => {
  return [
    ...[
      'SpikeGadgets',
      'Plexon',
      'Tucker-Davis Technologies',
      'Ripple Neuro',
      'BlackRock',
    ],
  ];
};

/**
 * Data Acquisition Device System
 *
 * @returns New system object
 */
export const dataAcqDeviceSystem = () => {
  return [
    ...[
      'Main Control Unit',
      'SpikeGadgets',
      'Pegasus',
      'OmniPlex',
      'Synapse',
      'Nano2',
      'Nano2+Stim',
      'Pico2',
      'Pico2+Stim',
    ],
  ];
};

/**
 * Data Acquisition Device Amplifier
 *
 * @returns New amplifier object
 */
export const dataAcqDeviceAmplifier = () => {
  return [...['Sutter Instrument', 'Intan', 'A-M Systems']];
};

/**
 * Data Acquisition Device ADC circuit
 *
 * @returns New ADC Circuit object
 */
export const dataAcqDeviceADCCircuit = () => {
  return [...['Intan', 'A-M Systems']];
};

/**
 * Camera manufacturers
 *
 * @returns list of camera manufacturers
 */
export const cameraManufacturers = () => {
  return [
    ...[
      'Allied Vision',
      'Ximea',
      'Hamamatsu Photonics',
      'JENOPTIK AG',
      'PCO AG',
      'Photometrics',
      'QImaging Corporation',
      'SPOT Imaging Solutions',
      'Thorlabs',
      'Photonic Science',
      'Diffraction Limited',
      'Teledyne Technologies',
    ],
  ];
};

/**
 * Explicit human summaries for the device-type IDs that do not follow the regular
 * `{N}c-{S}s{L}mm…-{a}um-{b}um-{sl|dl}` SpikeGadgets encoding. Keyed by the exact probe ID.
 * @type {Readonly<Record<string, string>>}
 */
const DEVICE_TYPE_LABEL_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  'tetrode_12.5': 'Tetrode (12.5 µm)',
  'A1x32-6mm-50-177-H32_21mm': '32-ch, 1-shank, 6 mm (A1x32 H32)',
  'NET-EBL-128ch-single-shank': '128-ch, 1-shank (NET-EBL)',
});

/**
 * A recognition-friendly summary of an opaque probe/device-type ID (Phase 8A-2). The IDs encode
 * channels / shanks / length / contact spacing but read as noise (`128c-4s8mm6cm-20um-40um-sl`);
 * this renders e.g. "128-ch, 4-shank, 8 mm (20/40 µm)" for display while callers keep the raw ID
 * as the option **value** (it keys into trodes_to_nwb probe-metadata filenames — never change it).
 *
 * Display-only and pure: it does not alter `deviceTypes()` or any exported value. An unrecognized
 * ID falls back to itself (never hidden), so a newly-added probe still selects/exports correctly
 * even before it gets a summary here.
 *
 * @param id - The probe/device-type ID (an entry of {@link deviceTypes}).
 * @returns The human summary, or the raw ID when it is not recognized.
 */
export const deviceTypeLabel = (id: unknown): string => {
  if (typeof id !== 'string') return String(id ?? '');
  if (id in DEVICE_TYPE_LABEL_OVERRIDES) return DEVICE_TYPE_LABEL_OVERRIDES[id];
  // Regular SpikeGadgets-style id: {channels}c-{shanks}s{lengthMm}mm…-{spacingA}um-{spacingB}um-…
  const m = id.match(/^(\d+)c-(\d+)s(\d+)mm\w*?-(\d+)um-(\d+)um/);
  if (m) {
    const [, channels, shanks, lengthMm, spacingA, spacingB] = m;
    return `${channels}-ch, ${shanks}-shank, ${lengthMm} mm (${spacingA}/${spacingB} µm)`;
  }
  return id; // unknown shape → show the raw id rather than hide it
};

/**
 * List of device-types
 *
 * @returns Device types
 */
export const deviceTypes = () => {
  return [
    ...[
      'tetrode_12.5',
      'A1x32-6mm-50-177-H32_21mm',
      '128c-4s8mm6cm-20um-40um-sl',
      '128c-4s8mm6cm-15um-26um-sl',
      '128c-4s6mm6cm-20um-40um-sl',
      '128c-4s6mm6cm-15um-26um-sl',
      '128c-4s4mm6cm-20um-40um-sl',
      '128c-4s4mm6cm-15um-26um-sl',
      '32c-2s8mm6cm-20um-40um-dl',
      '64c-4s6mm6cm-20um-40um-dl',
      '64c-3s6mm6cm-20um-40um-sl',
      'NET-EBL-128ch-single-shank',
    ],
  ];
};

/**
 * List of units
 *
 * @returns Units
 */
export const units = () => {
  return [...['pm', 'nm', 'μm', 'mm', 'cm', 'in', 'yd', 'ft']];
};
