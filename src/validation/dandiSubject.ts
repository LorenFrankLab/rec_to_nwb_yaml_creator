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

// A Latin binomial: capitalized genus + a single lower-case species epithet
// (e.g. "Rattus norvegicus"). NWB Inspector's dandi-config species check is exactly
// this two-word form — trinomials/subspecies are NOT accepted, so we don't either...
const LATIN_BINOMIAL = /^[A-Z][a-z]+ [a-z]+$/;
// ...or an NCBI Taxonomy URI (e.g. "http://purl.obolibrary.org/obo/NCBITaxon_10116").
const NCBI_TAXON_URI = /^http:\/\/purl\.obolibrary\.org\/obo\/NCBITaxon_\d+$/;

/**
 * Whether a species value satisfies the DANDI requirement (Latin binomial or NCBI
 * Taxonomy URI). The value is tested **exactly as given** — surrounding whitespace is
 * NOT tolerated, because the exported value is what NWB Inspector validates; a padded
 * value that this helper accepted while the export emitted the padding would be
 * fail-open. Callers store a trimmed value, so the gate stays fail-closed for the
 * emitted string.
 *
 * @param value - Candidate species string.
 * @returns True when DANDI-valid.
 */
export function isValidSpecies(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return LATIN_BINOMIAL.test(value) || NCBI_TAXON_URI.test(value);
}

/**
 * Whether an id string contains a `/` (a DANDI CRITICAL violation for
 * `subject_id` / `session_id`). Non-string / empty values return false — their
 * presence/non-emptiness is enforced by the schema's required + pattern checks.
 *
 * @param value - Candidate id string.
 * @returns True when the id contains a slash.
 */
export function idHasSlash(value: unknown): boolean {
  return typeof value === 'string' && value.includes('/');
}
