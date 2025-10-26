/**
 * Path Normalization Utilities
 *
 * Converts AJV instancePath (slash-separated) to normalized dot notation
 * with array brackets for easier field referencing.
 */

/**
 * Converts AJV instancePath to normalized dot notation
 *
 * Examples:
 *   /experimenter → experimenter
 *   /subject/weight → subject.weight
 *   /cameras/0/id → cameras[0].id
 *   /electrode_groups/15/targeted_x → electrode_groups[15].targeted_x
 *
 * @param {string} ajvPath - AJV instancePath (slash-separated)
 * @returns {string} Normalized path (dot notation with array brackets)
 */
export function normalizeAjvPath(ajvPath) {
  if (!ajvPath || ajvPath === '/') return '';

  // Split on slashes and filter out empty strings
  const parts = ajvPath.split('/').filter(x => x);

  if (parts.length === 0) return '';

  // Build normalized path
  const normalized = parts.map((part, index) => {
    // Check if this part is a number (array index)
    if (/^\d+$/.test(part)) {
      // Array index - use bracket notation
      return `[${part}]`;
    }

    // Named property
    if (index === 0) {
      // First part - no prefix
      return part;
    }

    // Subsequent parts - add dot prefix
    return `.${part}`;
  }).join('');

  // Clean up any cases where we have ".[" (shouldn't happen with logic above, but defensive)
  return normalized.replace(/\.\[/g, '[');
}
