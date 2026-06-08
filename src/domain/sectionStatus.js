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
} from '../state/workspaceSelectors';

/** Section status values. `blocking` is reserved for Phase 3a (see file header). */
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
