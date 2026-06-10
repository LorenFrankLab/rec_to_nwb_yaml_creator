/**
 * The shared optogenetics field-presence predicate ({@link module:domain/optoCompleteness}
 * `optoFieldsPresence`) is the SINGLE definition consumed by BOTH the section-nav classifier
 * (`getAnimalOptoCompleteness`) and the export gate (`partial_configuration` rule). These tests pin
 * the predicate itself AND prove the two call sites now agree on a malformed (non-array) input — the
 * exact case that used to make the nav count disagree with the export gate.
 */
import { describe, it, expect } from 'vitest';
import { optoFieldsPresence } from '../optoCompleteness';
import { getAnimalOptoCompleteness, OPTO_COMPLETENESS } from '../sectionStatus';
import { rulesValidation } from '../../validation/rulesValidation';

describe('optoFieldsPresence (shared predicate)', () => {
  it('counts a non-empty array list field as present and an empty one as absent', () => {
    expect(optoFieldsPresence({ opto_excitation_source: [{ name: 'LED' }] }).opto_excitation_source).toBe(true);
    expect(optoFieldsPresence({ opto_excitation_source: [] }).opto_excitation_source).toBe(false);
    expect(optoFieldsPresence({}).opto_excitation_source).toBe(false);
  });

  it('treats a non-array TRUTHY list value (e.g. a corrupt string) as NOT present', () => {
    // This is the divergence the shared predicate closes: the old export rule used
    // `value?.length > 0` (no Array.isArray guard), so a string would count "present".
    const presence = optoFieldsPresence({
      opto_excitation_source: 'oops',
      optical_fiber: 'still-a-string',
      virus_injection: { 0: 'x' }, // object with .length undefined — also not an array
    });
    expect(presence.opto_excitation_source).toBe(false);
    expect(presence.optical_fiber).toBe(false);
    expect(presence.virus_injection).toBe(false);
    expect(presence.count).toBe(0);
  });

  it('requires the software field to be a non-empty trimmed string', () => {
    expect(optoFieldsPresence({ optogenetic_stimulation_software: 'fsgui' }).optogenetic_stimulation_software).toBe(true);
    expect(optoFieldsPresence({ optogenetic_stimulation_software: '   ' }).optogenetic_stimulation_software).toBe(false);
    expect(optoFieldsPresence({ optogenetic_stimulation_software: '' }).optogenetic_stimulation_software).toBe(false);
    expect(optoFieldsPresence({ optogenetic_stimulation_software: 5 }).optogenetic_stimulation_software).toBe(false);
  });

  it('counts all four present fields', () => {
    expect(
      optoFieldsPresence({
        opto_excitation_source: [{ name: 'LED' }],
        optical_fiber: [{ name: 'F' }],
        virus_injection: [{ name: 'V' }],
        optogenetic_stimulation_software: 'fsgui',
      }).count
    ).toBe(4);
  });

  it('is robust to a null/undefined source', () => {
    expect(() => optoFieldsPresence(null)).not.toThrow();
    expect(optoFieldsPresence(null).count).toBe(0);
    expect(optoFieldsPresence(undefined).count).toBe(0);
  });
});

describe('section-nav classifier and export gate agree on a malformed (non-array) opto field', () => {
  // A single corrupt string in `opto_excitation_source` (and nothing else). Under the OLD code the
  // export gate counted it "present" (→ partial_configuration error), while the nav counted it
  // "absent" (→ NONE). With the shared predicate both must treat it as NOT present.
  const corruptFlat = { opto_excitation_source: 'corrupt-not-an-array' };
  const corruptNested = { optogenetics: { opto_excitation_source: 'corrupt-not-an-array' } };

  it('the export rule does NOT flag partial_configuration for a corrupt non-array field', () => {
    const issues = rulesValidation(corruptFlat);
    expect(issues.some((i) => i.code === 'partial_configuration')).toBe(false);
  });

  it('getAnimalOptoCompleteness reports NONE for the same corrupt input', () => {
    expect(getAnimalOptoCompleteness(corruptNested)).toBe(OPTO_COMPLETENESS.NONE);
  });

  it('a PARTIAL set of valid fields still flags both the gate and the nav', () => {
    // Sanity: the shared predicate does not loosen the real partial-detection behavior.
    const partialFlat = { opto_excitation_source: [{ name: 'LED' }] };
    const partialNested = { optogenetics: { opto_excitation_source: [{ name: 'LED' }] } };
    expect(rulesValidation(partialFlat).some((i) => i.code === 'partial_configuration')).toBe(true);
    expect(getAnimalOptoCompleteness(partialNested)).toBe(OPTO_COMPLETENESS.PARTIAL);
  });
});
