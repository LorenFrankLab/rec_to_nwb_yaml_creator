/**
 * Per-section status for the tabbed animal view's section-nav (Phase 1 — tabbed-workspace-ia,
 * Task 1.1c / decision 11).
 *
 * Phase 1 surfaces the **onboarding** signal only: a neutral hollow-○ "todo" ring on a
 * **never-configured** setup section, so a fresh animal still shows "what do I need to add?"
 * (decision 8) without the anxiety-coloured "done/review" dots the four-state design used.
 *
 * The **blocking-red** state (a section that blocks export) is intentionally NOT computed here:
 * it requires per-section validation attribution (which validation error belongs to which
 * section), the same mapping Phase 3a builds for repair routing. It lands with that work — see
 * phase-3a-repair-routing.md. Until then a section is either `todo` (empty) or `none`.
 */

import {
  getAnimalElectrodeGroups,
  getDataAcqDevices,
  getAnimalCameras,
  getAnimalDayIds,
} from '../state/workspaceSelectors';
import { mergeDayMetadata } from '../state/workspaceUtils';
import { validateDay, repairTargetForIssue, animalSetupTabForFieldPath } from './validation';
import { optoFieldsPresence } from './optoCompleteness';

/** Section status values. `blocking` (Phase 3a.5) is computed separately — see getAnimalBlockingSections. */
export const SECTION_STATUS = {
  TODO: 'todo',
  NONE: 'none',
};

/**
 * Optogenetics completeness classification for the section-nav count slot. Mirrors the export rule
 * {@link module:validation/rulesValidation} `partial_configuration` (rulesValidation.js): opto is
 * gated on FOUR fields each being present and non-empty.
 */
export const OPTO_COMPLETENESS = {
  COMPLETE: 'complete',
  PARTIAL: 'partial',
  NONE: 'none',
};

/**
 * Classify an animal's optogenetics setup as COMPLETE, PARTIAL, or NONE, using the SAME four-field
 * definition as the export rule's `partial_configuration` (rulesValidation.js ~lines 93-104):
 * `opto_excitation_source` / `optical_fiber` / `virus_injection` each a non-empty array, and
 * `optogenetic_stimulation_software` a non-empty (trimmed) string.
 *
 * COMPLETE → all four present. PARTIAL → some-but-not-all. NONE → none (the never-configured case
 * the hollow-○ todo path owns). Shape-safe: a malformed `optogenetics` yields NONE rather than
 * throwing.
 *
 * @param {object} animal - The animal record.
 * @returns {string} One of {@link OPTO_COMPLETENESS}.
 */
export function getAnimalOptoCompleteness(animal) {
  const opto = animal?.optogenetics;
  if (!opto || typeof opto !== 'object' || Array.isArray(opto)) return OPTO_COMPLETENESS.NONE;
  // SAME shared predicate as the export gate (rulesValidation `partial_configuration`), reading the
  // NESTED animal.optogenetics.* — so the nav count and the gate can never disagree.
  const present = optoFieldsPresence(opto).count;
  if (present === 0) return OPTO_COMPLETENESS.NONE;
  if (present === 4) return OPTO_COMPLETENESS.COMPLETE;
  return OPTO_COMPLETENESS.PARTIAL;
}

/**
 * Map of setup-section key → predicate "is this section configured for the animal?".
 * Day-work sections (`days`, `export`) are absent — they never carry a setup todo.
 *
 * Optogenetics is "configured" ONLY when its setup is COMPLETE (all four export-gated fields
 * present), using the SAME {@link getAnimalOptoCompleteness} classification the section-nav count
 * uses. A PARTIAL opto (toggle on, some-but-not-all fields) therefore reads TODO on the setup card
 * — agreeing with both the nav's "incomplete" count and the export gate — instead of a misleading
 * "Done" that contradicts them.
 */
const SETUP_SECTION_IS_CONFIGURED = {
  'electrode-groups': (animal) => getAnimalElectrodeGroups(animal).length > 0,
  'recording-system': (animal) => getDataAcqDevices(animal).length > 0,
  cameras: (animal) => getAnimalCameras(animal).length > 0,
  optogenetics: (animal) =>
    getAnimalOptoCompleteness(animal) === OPTO_COMPLETENESS.COMPLETE,
};

/**
 * The section-nav status for one section of one animal (Phase 1: `todo` | `none`).
 *
 * @param {object} animal - The animal record.
 * @param {string} sectionKey - A route `:tab` key (e.g. `cameras`, `days`).
 * @returns {string} `SECTION_STATUS.TODO` for a never-configured setup section, else `NONE`.
 */
export function getAnimalSectionStatus(animal, sectionKey) {
  const isConfigured = SETUP_SECTION_IS_CONFIGURED[sectionKey];
  // Day-work sections (and any unknown key) carry no setup todo.
  if (!isConfigured) return SECTION_STATUS.NONE;
  return isConfigured(animal) ? SECTION_STATUS.NONE : SECTION_STATUS.TODO;
}

/**
 * Per-setup-section item counts for the section-nav "information scent" (decision 10: name · count
 * · ›). Day-work sections (`days`, `export`) are absent — their counts (day count / "N ready")
 * depend on the workspace day map + the export validator and are computed by the view. Read through
 * the shape-safe selectors, so a malformed/recovered animal yields 0 rather than crashing.
 *
 * @param {object} animal - The animal record.
 * @returns {{ 'electrode-groups': number, 'recording-system': number, cameras: number }}
 */
export function getAnimalSetupCounts(animal) {
  return {
    'electrode-groups': getAnimalElectrodeGroups(animal).length,
    'recording-system': getDataAcqDevices(animal).length,
    cameras: getAnimalCameras(animal).length,
  };
}

/**
 * The set of animal-setup TAB keys that hold an export-BLOCKING error (Phase 3a.5 — the section-nav
 * red dot). Validates each of the animal's recording days with the SAME validator the export gate
 * uses ({@link validateDay}), keeps only error-severity issues whose owner is the animal setup
 * ({@link repairTargetForIssue} surface `animal`), and attributes each to its owning tab via the
 * SAME resolver the repair routing uses ({@link animalSetupTabForFieldPath}) — no second mapping.
 * Read-only over the existing validators; a day whose config can't be merged is skipped (its
 * corruption surfaces via the raw-shape banner, not here).
 *
 * @param {object} animal - The animal record.
 * @param {object} [days] - The workspace day map (`model.workspace.days`).
 * @returns {Set<string>} Tab keys (e.g. `electrode-groups`, `cameras`) with a blocking error.
 */
export function getAnimalBlockingSections(animal, days) {
  const blocking = new Set();
  if (!animal) return blocking;

  for (const dayId of getAnimalDayIds(animal)) {
    const day = days?.[dayId];
    if (!day) continue;
    let merged;
    try {
      merged = mergeDayMetadata(animal, day);
    } catch {
      // Unreadable day config — its corruption is surfaced by the raw-shape banner, not the dot.
      continue;
    }
    // `animalDays` is deliberately omitted: this only counts ANIMAL-surface blockers (the filter
    // below), and the cross-day blocks `animalDays` adds (bad-channel monotonicity) are day-surface,
    // so threading it here would change nothing. Not a missed call site.
    for (const issue of validateDay(day, merged, animal)) {
      if (issue.severity !== 'error') continue;
      if (repairTargetForIssue(issue).surface !== 'animal') continue;
      // Attribute via the SAME field input repairTargetForIssue uses for its tab label
      // (`path || instancePath`), so the dot's tab and the repair button's label can never diverge.
      const { tab } = animalSetupTabForFieldPath(issue.path || issue.instancePath);
      blocking.add(tab);
    }
  }
  return blocking;
}
