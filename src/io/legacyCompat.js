/**
 * @file Compatibility aliases for released trodes_to_nwb versions.
 * @module io/legacyCompat
 */

/**
 * Adds duplicate keys that released trodes_to_nwb versions read, so a file
 * exported today converts without waiting for a converter release.
 *
 * Currently one alias: virus_injection[].volume_in_uL mirrors volume_in_ul.
 * The shared nwb_schema.json requires volume_in_ul and the form stores only
 * that key, but released trodes_to_nwb reads volume_in_uL
 * (convert_optogenetics.py) and raises KeyError without it. Writing both with
 * the same value also removes the old failure mode, where the form's untouched
 * volume_in_uL default sat beside the user's volume_in_ul and the converter
 * recorded the default.
 *
 * Applied on export only: form state and validation keep volume_in_ul as the
 * single source of truth. Remove this alias once every trodes_to_nwb version
 * in use reads volume_in_ul.
 *
 * @param {object} form - Form data about to be encoded
 * @returns {object} A copy carrying the aliases, or `form` itself when there
 *   is nothing to alias
 */
export function withLegacyConverterKeys(form) {
  const injections = form?.virus_injection;

  const needsAlias =
    Array.isArray(injections) &&
    injections.some((injection) => injection?.volume_in_ul !== undefined);

  if (!needsAlias) {
    return form;
  }

  const updated = structuredClone(form);
  updated.virus_injection.forEach((injection) => {
    if (injection?.volume_in_ul !== undefined) {
      injection.volume_in_uL = injection.volume_in_ul;
    }
  });

  return updated;
}
