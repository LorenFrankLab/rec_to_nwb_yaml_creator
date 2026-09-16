import { optoExcitationModelNames, opticalFiberModelNames, virusNames } from '../valueList';
import type { OptoFields, OptoFieldsPresence } from './optoCompleteness';
/** A single configurable optogenetics field (drives {@link renderField}). */
export interface OptoFieldDef {
  name: string;
  label: string;
  type: string;
  options?: string[];
  placeholder?: string;
  help?: string;
}

export const EXCITATION_FIELDS: OptoFieldDef[] = [
  { name: 'name', label: 'Setup name', type: 'text' },
  { name: 'model_name', label: 'Hardware model name', type: 'datalist', options: optoExcitationModelNames() },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'wavelength_in_nm', label: 'Wavelength (nm)', type: 'number', placeholder: 'e.g. 473' },
  { name: 'power_in_W', label: 'Source power (W)', type: 'number', placeholder: 'e.g. 0.01 (= 10 mW)' },
  { name: 'intensity_in_W_per_m2', label: 'Intensity (W/m²)', type: 'number', placeholder: 'e.g. 1.0' },
];

export const FIBER_FIELDS: OptoFieldDef[] = [
  { name: 'name', label: 'Fiber implant name', type: 'text' },
  { name: 'hardware_name', label: 'Fiber hardware model', type: 'datalist', options: opticalFiberModelNames() },
  { name: 'implanted_fiber_description', label: 'Implant description', type: 'text' },
  { name: 'hemisphere', label: 'Hemisphere', type: 'select', options: ['left', 'right'] },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'ap_in_mm', label: 'AP (mm)', type: 'number' },
  { name: 'ml_in_mm', label: 'ML (mm)', type: 'number' },
  { name: 'dv_in_mm', label: 'DV (mm)', type: 'number' },
  { name: 'roll_in_deg', label: 'Roll (deg)', type: 'number' },
  { name: 'pitch_in_deg', label: 'Pitch (deg)', type: 'number' },
  { name: 'yaw_in_deg', label: 'Yaw (deg)', type: 'number' },
  // Coordinate reference — required by trodes_to_nwb (read unconditionally).
  {
    name: 'reference',
    label: 'Coordinate reference',
    type: 'text',
    placeholder: 'e.g. bregma',
    help: 'Stereotaxic reference for the AP/ML/DV coordinates.',
  },
];

export const VIRUS_FIELDS: OptoFieldDef[] = [
  { name: 'name', label: 'Injection name', type: 'text' },
  { name: 'description', label: 'Description', type: 'text' },
  { name: 'virus_name', label: 'Virus name', type: 'datalist', options: virusNames() },
  // volume_in_uL is the converter spelling; the export also emits volume_in_ul.
  { name: 'volume_in_uL', label: 'Volume (µL)', type: 'number' },
  { name: 'titer_in_vg_per_ml', label: 'Titer (vg/mL)', type: 'number' },
  { name: 'hemisphere', label: 'Hemisphere', type: 'select', options: ['left', 'right'] },
  { name: 'location', label: 'Location', type: 'text' },
  { name: 'ap_in_mm', label: 'AP (mm)', type: 'number' },
  { name: 'ml_in_mm', label: 'ML (mm)', type: 'number' },
  { name: 'dv_in_mm', label: 'DV (mm)', type: 'number' },
  { name: 'roll_in_deg', label: 'Roll (deg)', type: 'number' },
  { name: 'pitch_in_deg', label: 'Pitch (deg)', type: 'number' },
  { name: 'yaw_in_deg', label: 'Yaw (deg)', type: 'number' },
  // Coordinate reference — required by trodes_to_nwb (read unconditionally).
  {
    name: 'reference',
    label: 'Coordinate reference',
    type: 'text',
    placeholder: 'e.g. bregma',
    help: 'Stereotaxic reference for the AP/ML/DV coordinates.',
  },
];


/** Counts complete sections, including every required field in every row. Zero is a valid coordinate. */
export function optoSetupCompleteness(opto: OptoFields | null | undefined): OptoFieldsPresence {
  const complete = (items: unknown, fields: OptoFieldDef[]) => Array.isArray(items) && items.length > 0 && items.every((item) => fields.every((field) => {
    const value = item?.[field.name] ?? (field.name === 'volume_in_uL' ? item?.volume_in_ul : undefined);
    if (field.type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (field.type === 'select') return field.options?.includes(value) ?? false;
    return typeof value === 'string' && value.trim() !== '';
  }));
  const sections = {
    opto_excitation_source: complete(opto?.opto_excitation_source, EXCITATION_FIELDS) && (opto?.opto_excitation_source as unknown[]).length === 1,
    optical_fiber: complete(opto?.optical_fiber, FIBER_FIELDS),
    virus_injection: complete(opto?.virus_injection, VIRUS_FIELDS),
    optogenetic_stimulation_software: typeof opto?.optogenetic_stimulation_software === 'string' && opto.optogenetic_stimulation_software.trim() !== '',
  };
  return { ...sections, count: Object.values(sections).filter(Boolean).length };
}
