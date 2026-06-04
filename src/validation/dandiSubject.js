/**
 * DANDI subject-conformance helpers.
 *
 * The NWB files produced from this metadata are published to DANDI, whose NWB
 * Inspector (dandi config) promotes certain Subject checks to CRITICAL (blocking):
 * `species` must be a Latin binomial or an NCBI Taxonomy URI (free text like "Rat"
 * is rejected), and `subject_id` / `session_id` must contain no `/`.
 *
 * These helpers are the single source of truth used both at the editing surface
 * (the animal-creation form) and by the export-gate validation rule, so the UI and
 * the gate cannot disagree.
 */

// A Latin binomial (or trinomial): capitalized genus + one or more lower-case
// epithets (e.g. "Rattus norvegicus", "Mus musculus domesticus")...
const LATIN_BINOMIAL = /^[A-Z][a-z]+( [a-z]+)+$/;
// ...or an NCBI Taxonomy URI (e.g. "http://purl.obolibrary.org/obo/NCBITaxon_10116").
const NCBI_TAXON_URI = /^http:\/\/purl\.obolibrary\.org\/obo\/NCBITaxon_\d+$/;

/**
 * Whether a species value satisfies the DANDI requirement (Latin binomial or NCBI
 * Taxonomy URI). Surrounding whitespace is tolerated.
 *
 * @param {*} value - Candidate species string.
 * @returns {boolean} True when DANDI-valid.
 */
export function isValidSpecies(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return LATIN_BINOMIAL.test(trimmed) || NCBI_TAXON_URI.test(trimmed);
}

/**
 * Whether an id string contains a `/` (a DANDI CRITICAL violation for
 * `subject_id` / `session_id`). Non-string / empty values return false — their
 * presence/non-emptiness is enforced by the schema's required + pattern checks.
 *
 * @param {*} value - Candidate id string.
 * @returns {boolean} True when the id contains a slash.
 */
export function idHasSlash(value) {
  return typeof value === 'string' && value.includes('/');
}
