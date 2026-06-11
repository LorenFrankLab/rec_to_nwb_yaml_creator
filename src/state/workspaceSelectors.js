/**
 * @fileoverview Shape-safe canonical read layer for raw workspace state.
 *
 * Raw persisted state (animal / day records) MAY be corrupt after an import, migration,
 * or an old save: a `cameras` that is a string, a `configurationHistory` that is `{}`, a
 * `session` that is `null`. The app's invariant is that **canonical UI state must be safe
 * to render** even when raw state is not — but it must NEVER decide export validity (a
 * corrupt field is still flagged by raw-shape validation and blocks export).
 *
 * This module is the SINGLE place those guards live. Every component and the export merge
 * read raw collections/records through these selectors instead of ad-hoc `x || []` /
 * `Array.isArray(x) ? x : []`. That makes the recurring "one component still used `|| []`"
 * bug structurally impossible: there is no ad-hoc access left to get wrong, and
 * `workspaceSelectors.guard.test.js` forbids it from creeping back in.
 *
 * Selectors NEVER mutate, NEVER throw, and ALWAYS return a safe value (an array for list
 * fields, a record `{}` for object fields). A well-formed value is returned by reference
 * so callers can rely on identity where they did before.
 */

/**
 * @param {*} value
 * @returns {Array} `value` if it is an array, else a fresh empty array.
 */
const asArray = (value) => (Array.isArray(value) ? value : []);

/**
 * @param {*} value
 * @returns {object} `value` if it is a plain object record (not null/array), else `{}`.
 */
const asRecord = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};

// ── Animal-owned collections / records ──────────────────────────────────────────────

/** @param {object} animal @returns {Array} The animal's cameras (always an array). */
export const getAnimalCameras = (animal) => asArray(animal?.cameras);

/**
 * VESTIGIAL: the animal-level behavioral-events library was retired — behavioral events are now
 * day-owned (`day.behavioral_events`, the only ones exported). `animal.behavioral_events` is left
 * in the persisted blob for backward/forward compatibility but is no longer read by the app. This
 * selector is retained (no consumer beyond its own test) so a future migration could relocate the
 * field; see `.claude/docs/plans/dio-per-day-sets/phase-2b-retire-animal-library.md`.
 *
 * @param {object} animal @returns {Array} The animal's (vestigial) behavioral events.
 */
export const getAnimalBehavioralEvents = (animal) => asArray(animal?.behavioral_events);

/** @param {object} animal @returns {Array} The animal's configuration history. */
export const getConfigHistory = (animal) => asArray(animal?.configurationHistory);

/** @param {object} animal @returns {object} The animal's devices record. */
export const getAnimalDevices = (animal) => asRecord(animal?.devices);

/** @param {object} animal @returns {Array} The animal's data-acquisition devices. */
export const getDataAcqDevices = (animal) => asArray(getAnimalDevices(animal).data_acq_device);

/** @param {object} animal @returns {Array} The animal's electrode groups. */
export const getAnimalElectrodeGroups = (animal) =>
  asArray(getAnimalDevices(animal).electrode_groups);

/** @param {object} animal @returns {Array} The animal's ntrode channel maps. */
export const getAnimalNtrodeMaps = (animal) =>
  asArray(getAnimalDevices(animal).ntrode_electrode_group_channel_map);

/**
 * Electrode groups of a ProbeConfiguration — the shape that exposes `electrode_groups` at
 * its TOP level. Pass a ProbeConfiguration, OR a snapshot's `.devices` (which IS one) — NOT
 * a whole snapshot `{version, devices}` (that would silently yield `[]`).
 * @param {object} probeConfig - A ProbeConfiguration (or snapshot.devices).
 * @returns {Array}
 */
export const getProbeElectrodeGroups = (probeConfig) =>
  asArray(asRecord(probeConfig).electrode_groups);

/**
 * Ntrode channel maps of a ProbeConfiguration (top-level `ntrode_electrode_group_channel_map`).
 * Pass a ProbeConfiguration or a snapshot's `.devices`, NOT a whole snapshot.
 * @param {object} probeConfig - A ProbeConfiguration (or snapshot.devices).
 * @returns {Array}
 */
export const getProbeNtrodeMaps = (probeConfig) =>
  asArray(asRecord(probeConfig).ntrode_electrode_group_channel_map);

/** @param {object} animal @returns {object} The animal's subject record (always a record). */
export const getAnimalSubject = (animal) => asRecord(animal?.subject);

/** @param {object} animal @returns {object} The animal's experimenters record. */
export const getAnimalExperimenters = (animal) => asRecord(animal?.experimenters);

/** @param {object} animal @returns {Array} The experimenter_name list (always an array). */
export const getExperimenterNames = (animal) =>
  asArray(getAnimalExperimenters(animal).experimenter_name);

/** @param {object} animal @returns {Array} The animal's day ids (always an array). */
export const getAnimalDayIds = (animal) => asArray(animal?.days);

/**
 * The id of the animal's latest-dated day present in `days`, or null. Day dates are `YYYY-MM-DD`
 * (lexicographic compare == chronological). Tolerates a corrupt animal, a missing `days` map, a
 * dangling id, or a record without a string `date`.
 * @param {object} animal
 * @param {object} days
 * @returns {string|null}
 */
export const getMostRecentDayId = (animal, days) => {
  const present = getAnimalDayIds(animal)
    .map((id) => (days && typeof days === 'object' ? days[id] : undefined))
    .filter((d) => d && typeof d.id === 'string' && typeof d.date === 'string');
  if (present.length === 0) return null;
  present.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return present[0].id;
};

/**
 * Other animals whose recording has a non-empty behavioral-event (DIO) set to copy from, for
 * bootstrapping a new animal's first day. For each qualifying animal (≠ `currentAnimalId`), returns
 * its MOST-RECENT day's set (the current rig wiring; sets are near-constant across an animal's days,
 * so the latest is representative). Animals with no day or no named events are omitted. Tolerates a
 * corrupt/missing workspace shape.
 *
 * @param {object} workspace - The workspace (`{ animals, days }`).
 * @param {string} currentAnimalId - The animal being edited (excluded from the result).
 * @returns {Array<{id: string, name: string, date: string, events: Array<{description: string, name: string}>}>}
 */
export const getCopyableDioSources = (workspace, currentAnimalId) => {
  const animals = asRecord(workspace?.animals);
  const days = asRecord(workspace?.days);
  const sources = [];
  Object.entries(animals).forEach(([animalId, animal]) => {
    if (animalId === currentAnimalId) return;
    const withDio = getAnimalDayIds(animal)
      .map((id) => days[id])
      .filter((d) => d && typeof d.date === 'string' && getDayBehavioralEvents(d).length > 0);
    if (withDio.length === 0) return;
    withDio.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    const sourceDay = withDio[0];
    sources.push({
      id: animalId,
      name: getAnimalSubject(animal).subject_id || animalId,
      date: sourceDay.date,
      events: getDayBehavioralEvents(sourceDay),
    });
  });
  return sources;
};

// ── Day-owned collections / records ─────────────────────────────────────────────────

/** @param {object} day @returns {object} The day's session record (always a record). */
export const getDaySession = (day) => asRecord(day?.session);

/** @param {object} day @returns {Array} The day's tasks (always an array). */
export const getDayTasks = (day) => asArray(day?.tasks);

/** @param {object} day @returns {Array} The day's associated video files. */
export const getDayAssociatedVideos = (day) => asArray(day?.associated_video_files);

/** @param {object} day @returns {Array} The day's associated files. */
export const getDayAssociatedFiles = (day) => asArray(day?.associated_files);

/** @param {object} day @returns {Array} The day's behavioral events. */
export const getDayBehavioralEvents = (day) => asArray(day?.behavioral_events);

/** @param {object} day @returns {Array} The day's keywords. */
export const getDayKeywords = (day) => asArray(day?.keywords);

/** @param {object} day @returns {Array} The day's FsGUI protocol files. */
export const getDayFsGuiYamls = (day) => asArray(day?.fs_gui_yamls);

/** @param {object} day @returns {Array} The day's used-camera ids (always an array). */
export const getDayCamerasUsed = (day) => asArray(day?.cameras_used);

/**
 * @param {object} day
 * @returns {Record<string, number[]>} The day's per-ntrode bad-channel overrides as a
 *   record (always a record — `{}` when absent/corrupt). Bad channels are day-owned.
 */
export const getDayBadChannelOverrides = (day) => asRecord(day?.deviceOverrides?.bad_channels);

/**
 * @param {object} day
 * @returns {(string|undefined)} The day's recording-system catalog reference, or `undefined`
 *   when absent/non-string.
 */
export const getDayDataAcqDeviceName = (day) =>
  typeof day?.data_acq_device_name === 'string' ? day.data_acq_device_name : undefined;
