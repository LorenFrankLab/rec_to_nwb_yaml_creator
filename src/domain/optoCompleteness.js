/**
 * The SINGLE source of truth for "which optogenetics fields count as present".
 *
 * trodes_to_nwb gates ALL optogenetics on FOUR keys each being present and non-empty
 * (convert_optogenetics.py: `virus_injection`, `opto_excitation_source`, `optical_fiber`,
 * `optogenetic_stimulation_software`); if any is missing it logs "No available optogenetic
 * metadata" and silently returns an opto-less NWB. Two independent definitions of "present" used
 * to live in this codebase — the section-nav classifier ({@link module:domain/sectionStatus}
 * `getAnimalOptoCompleteness`) and the export gate ({@link module:validation/rulesValidation}
 * `partial_configuration` rule). For VALID data (the three list fields are arrays) they agreed, but
 * a CORRUPT non-array (e.g. a string) field was counted "present" by the export gate (no
 * `Array.isArray` guard) yet "absent" by the nav — so the nav count could disagree with the gate.
 *
 * Both call sites now consume THIS predicate so they can never drift. The arrays use the stricter,
 * correct `Array.isArray(...) && length > 0` (a corrupt string list is NOT present); the software is
 * a non-empty trimmed string. `sectionStatus` reads the NESTED `animal.optogenetics.*` while the
 * export rule reads the FLAT merged `model.*`, so the predicate takes the four VALUES (each call
 * site reads them from its own source).
 */

/**
 * A list opto field counts as present only when it's a non-empty array (corrupt non-array → absent).
 * @param value
 */
const isOptoListPresent = (value) => Array.isArray(value) && value.length > 0;

/**
 * The software field counts as present only when it's a non-empty trimmed string.
 * @param value
 */
const isOptoSoftwarePresent = (value) => typeof value === 'string' && value.trim() !== '';

/**
 * Compute the per-field presence of the four optogenetics fields from their VALUES.
 *
 * @param {object} fields - The four field values (read from the caller's own source).
 * @param {*} fields.opto_excitation_source - The excitation-source list.
 * @param {*} fields.optical_fiber - The optical-fiber list.
 * @param {*} fields.virus_injection - The virus-injection list.
 * @param {*} fields.optogenetic_stimulation_software - The stimulation-software string.
 * @returns {{
 *   opto_excitation_source: boolean,
 *   optical_fiber: boolean,
 *   virus_injection: boolean,
 *   optogenetic_stimulation_software: boolean,
 *   count: number,
 * }} Each field's presence boolean plus the total count of present fields.
 */
export function optoFieldsPresence(fields) {
  const source = fields || {};
  const presence = {
    opto_excitation_source: isOptoListPresent(source.opto_excitation_source),
    optical_fiber: isOptoListPresent(source.optical_fiber),
    virus_injection: isOptoListPresent(source.virus_injection),
    optogenetic_stimulation_software: isOptoSoftwarePresent(
      source.optogenetic_stimulation_software
    ),
  };
  presence.count = [
    presence.opto_excitation_source,
    presence.optical_fiber,
    presence.virus_injection,
    presence.optogenetic_stimulation_software,
  ].filter(Boolean).length;
  return presence;
}
