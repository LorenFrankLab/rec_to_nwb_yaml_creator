/**
 * @fileoverview Optogenetics business rules (extracted from rulesValidation.js, Phase split).
 *
 * trodes_to_nwb gates ALL optogenetics on the four sections being present + non-empty and on
 * exactly one excitation source, and unconditionally reads `optical_fiber[].reference` /
 * `virus_injection[].reference`. These rules block the partial / multi-source / missing-reference
 * states that would otherwise silently drop optogenetics or crash conversion. Pure; moved verbatim.
 */

import { optoFieldsPresence } from '../../domain/optoCompleteness';

/**
 * Rules 3 / 3c / 3b: optogenetics completeness, coordinate references, and single excitation source.
 *
 * @param {object} model - The form data to validate.
 * @returns {object[]} Validation issues.
 */
export function optogeneticsRules(model) {
  const issues = [];

  // Rule 3: Optogenetics all-or-nothing configuration. trodes_to_nwb gates ALL
  // optogenetics on FOUR keys each being present and non-empty (convert_optogenetics.py:
  // virus_injection, opto_excitation_source, optical_fiber, optogenetic_stimulation_software);
  // if any is missing it logs "No available optogenetic metadata" and silently returns,
  // producing an NWB with no optogenetics at all. So a partial opto session must block
  // export rather than convert to an opto-less file.
  // Field presence comes from the SINGLE shared predicate (domain/optoCompleteness) the
  // section-nav classifier (getAnimalOptoCompleteness) also consumes, so the export gate and the
  // nav count can never drift. The arrays use Array.isArray(...) && length > 0 (a corrupt non-array
  // value is NOT present); the software is a non-empty trimmed string — matching the converter's
  // len()>0 on the string.
  const optoPresence = optoFieldsPresence(model);
  const hasOptoSource = optoPresence.opto_excitation_source;
  const hasOpticalFiber = optoPresence.optical_fiber;
  const hasVirusInjection = optoPresence.virus_injection;
  const hasOptoSoftware = optoPresence.optogenetic_stimulation_software;
  const optoFieldsPresent = optoPresence.count;

  // Partial configuration detected (some but not all FOUR sections present).
  if (optoFieldsPresent > 0 && optoFieldsPresent < 4) {
    issues.push({
      path: 'optogenetics',
      code: 'partial_configuration',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `Partial optogenetics configuration detected. All fields required (or none) — ` +
        `trodes_to_nwb silently drops ALL optogenetics unless every section is present: ` +
        `opto_excitation_source${hasOptoSource ? ' ✓' : ' ✗'}, ` +
        `optical_fiber${hasOpticalFiber ? ' ✓' : ' ✗'}, ` +
        `virus_injection${hasVirusInjection ? ' ✓' : ' ✗'}, ` +
        `optogenetic_stimulation_software${hasOptoSoftware ? ' ✓' : ' ✗'}`
    });
  }

  // Rule 3c: optical fibers and virus injections must carry a `reference`. trodes_to_nwb
  // reads `optical_fiber[].reference` / `virus_injection[].reference` UNCONDITIONALLY
  // (`metadata["reference"]`, KeyError if missing) in make_optical_fiber/make_virus_injection.
  // The schema does NOT require it and the editor must collect it, so an item lacking a
  // non-empty reference would crash conversion — block it here.
  const nonEmptyStr = (v) => typeof v === 'string' && v.trim() !== '';
  [
    ['optical_fiber', model.optical_fiber],
    ['virus_injection', model.virus_injection],
  ].forEach(([key, items]) => {
    if (!Array.isArray(items)) return;
    items.forEach((item, i) => {
      if (!nonEmptyStr(item?.reference)) {
        issues.push({
          path: `${key}[${i}].reference`,
          field: 'reference',
          code: 'missing_opto_reference',
          repairSurface: 'animal',
          severity: 'error',
          message:
            `${key === 'optical_fiber' ? 'Optical fiber' : 'Virus injection'} ${i + 1}` +
            `${nonEmptyStr(item?.name) ? ` ("${item.name}")` : ''} is missing a coordinate ` +
            `reference (e.g. "Bregma at the cortical surface"). trodes_to_nwb requires it and ` +
            `crashes without it.`,
        });
      }
    });
  });

  // Rule 3b: exactly one excitation source. trodes_to_nwb raises a ValueError when
  // opto_excitation_source has more than one entry ("Multiple optogenetic sources are
  // not supported"), so a 2+-source session must block export.
  if (Array.isArray(model.opto_excitation_source) && model.opto_excitation_source.length > 1) {
    issues.push({
      path: 'opto_excitation_source',
      code: 'multiple_excitation_sources',
      repairSurface: 'animal',
      severity: 'error',
      message:
        `${model.opto_excitation_source.length} optogenetic excitation sources are defined, ` +
        `but trodes_to_nwb supports exactly one (it raises an error on more). Keep a single ` +
        `opto_excitation_source.`
    });
  }

  return issues;
}
