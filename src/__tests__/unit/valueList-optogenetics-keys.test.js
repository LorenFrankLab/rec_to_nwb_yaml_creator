/**
 * Optogenetics defaults and option lists must use the keys and names that
 * the shared nwb_schema.json and trodes_to_nwb actually read. A default under
 * a differently-cased key is exported alongside the user's value and wins
 * downstream; a model name absent from trodes_to_nwb's device metadata makes
 * conversion raise.
 */

import { describe, it, expect } from 'vitest';
import { arrayDefaultValues, optoExcitationModelNames } from '../../valueList';
import schema from '../../nwb_schema.json';

describe('opto_excitation_source model names', () => {
  it('lists the model names trodes_to_nwb ships device metadata for', () => {
    const names = optoExcitationModelNames();
    expect(names).toContain('LuxX+ 638-200');
    expect(names).toContain('Omicron LuxX+ 488-100');
    expect(names).not.toContain('Lux+ 638-200');
  });

  it('uses a default model_name that appears in the option list', () => {
    expect(optoExcitationModelNames()).toContain(
      arrayDefaultValues.opto_excitation_source.model_name
    );
  });
});

describe('virus_injection defaults', () => {
  it('uses the schema key volume_in_ul, not a differently-cased duplicate', () => {
    const defaults = arrayDefaultValues.virus_injection;
    const schemaKeys = Object.keys(schema.properties.virus_injection.items.properties);
    expect(schemaKeys).toContain('volume_in_ul');
    expect(defaults).toHaveProperty('volume_in_ul');
    expect(defaults).not.toHaveProperty('volume_in_uL');
  });
});

describe('fs_gui_yamls defaults', () => {
  it('uses the schema key trainInterval that trodes_to_nwb reads', () => {
    const defaults = arrayDefaultValues.fs_gui_yamls;
    const schemaKeys = Object.keys(schema.properties.fs_gui_yamls.items.properties);
    expect(schemaKeys).toContain('trainInterval');
    expect(defaults).toHaveProperty('trainInterval');
    expect(defaults).not.toHaveProperty('train_interval');
  });
});
