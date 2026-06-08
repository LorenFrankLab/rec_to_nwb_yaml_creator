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
  getAnimalNtrodeMaps,
  getDataAcqDevices,
  getAnimalCameras,
  getAnimalBehavioralEvents,
  getAnimalDayIds,
} from '../state/workspaceSelectors';
import { mergeDayMetadata } from '../state/workspaceUtils';
import { validateDay, repairTargetForIssue, animalSetupTabForFieldPath } from './validation';

/** Section status values. `blocking` (Phase 3a.5) is computed separately — see getAnimalBlockingSections. */
export const SECTION_STATUS = {
  TODO: 'todo',
  NONE: 'none',
};

/**
 * Whether an animal has any optogenetics setup. Opto is an optional config holding
 * excitation-source / optical-fiber / virus-injection lists; "configured" means any is non-empty.
 * (`animal.optogenetics` is not a selector-owned raw collection, so it is read directly.)
 *
 * @param {object} animal - The animal record.
 * @returns {boolean} True if any optogenetics setup is present.
 */
function hasOptogenetics(animal) {
  const opto = animal?.optogenetics;
  if (!opto || typeof opto !== 'object' || Array.isArray(opto)) return false;
  return ['opto_excitation_source', 'optical_fiber', 'virus_injection'].some(
    (key) => Array.isArray(opto[key]) && opto[key].length > 0
  );
}

/**
 * Map of setup-section key → predicate "is this section configured for the animal?".
 * Day-work sections (`days`, `export`) are absent — they never carry a setup todo.
 */
const SETUP_SECTION_IS_CONFIGURED = {
  'electrode-groups': (animal) => getAnimalElectrodeGroups(animal).length > 0,
  'channel-maps': (animal) => getAnimalNtrodeMaps(animal).length > 0,
  'recording-system': (animal) => getDataAcqDevices(animal).length > 0,
  cameras: (animal) => getAnimalCameras(animal).length > 0,
  dio: (animal) => getAnimalBehavioralEvents(animal).length > 0,
  optogenetics: hasOptogenetics,
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
    for (const issue of validateDay(day, merged, animal)) {
      if (issue.severity !== 'error') continue;
      if (repairTargetForIssue(issue).surface !== 'animal') continue;
      const { tab } = animalSetupTabForFieldPath(issue.focusPath || issue.path || issue.instancePath);
      blocking.add(tab);
    }
  }
  return blocking;
}
