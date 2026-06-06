/**
 * @fileoverview Pure workspace state transitions.
 *
 * The riskiest animal/day mutation recipes, extracted out of `useWorkspace` so their
 * invariants are testable outside React: updating animal devices while MIRRORING the edit
 * into the latest configuration snapshot, adding/applying/rebuilding configuration history,
 * creating a day pinned to the latest version, and safely updating a (possibly malformed)
 * day record. These are pure — they take the current record(s) + a timestamp and return the
 * next record(s); they never read the clock, touch localStorage, or call `setState`. The
 * hook keeps the side effects (hydration, autosave, debounce) and the existence-check throws.
 */

import { formatExperimentDate } from './workspaceUtils';
import { getAnimalDevices, getConfigHistory } from './workspaceSelectors';
import {
  normalizeDeviceOverrides,
  normalizeDevices,
  normalizeProbeConfigDevices,
} from '../utils/deviceNormalization';

/**
 * Apply partial updates to an animal and return the next animal record. A `devices` edit is
 * mirrored into the LATEST configuration snapshot (the authoritative source the export
 * resolves) so probes configured after creation actually reach `resolveDayConfig`;
 * reconfiguration forks a new latest version BEFORE editing, so this only ever rewrites the
 * current latest, never a frozen historical snapshot. An explicit `optogenetics: null`
 * clears opto (how the editor disables it).
 *
 * @param {object} animal - The current animal record.
 * @param {object} updates - Partial updates (subject/experimenters/devices/cameras/
 *   data_acq_device/technicalDefaults/behavioral_events/optogenetics).
 * @param {string} now - Timestamp to stamp `lastModified`.
 * @returns {object} The next animal record (deep-cloned; input not mutated).
 */
export function applyAnimalUpdates(animal, updates, now) {
  const updated = structuredClone(animal);

  if (updates.subject) {
    updated.subject = { ...updated.subject, ...updates.subject };
  }
  if (updates.experimenters) {
    updated.experimenters = { ...updated.experimenters, ...updates.experimenters };
  }
  if (updates.devices) {
    updated.devices = normalizeDevices({ ...getAnimalDevices(updated), ...updates.devices });
    // Mirror the edit into the latest snapshot (see file/function header).
    const history = getConfigHistory(updated);
    if (history.length > 0) {
      const latest = history[history.length - 1];
      latest.devices = {
        ...latest.devices,
        electrode_groups: structuredClone(updated.devices.electrode_groups),
        ntrode_electrode_group_channel_map: structuredClone(
          updated.devices.ntrode_electrode_group_channel_map
        ),
      };
    }
  }
  if (updates.cameras) {
    updated.cameras = updates.cameras;
  }
  // Data-acq hardware is an animal-level device read from `animal.devices.data_acq_device`.
  if (updates.data_acq_device) {
    updated.devices = normalizeDevices({
      ...getAnimalDevices(updated),
      data_acq_device: updates.data_acq_device,
    });
  }
  // Animal-level technical DEFAULTS only (seeded into each day's `technical` at createDay).
  if (updates.technicalDefaults) {
    updated.technicalDefaults = { ...updated.technicalDefaults, ...updates.technicalDefaults };
  }
  // Animal-level behavioral events are an editable reference; the exported source is the
  // day's `behavioral_events`. Persist them so the editor and the model agree.
  if (updates.behavioral_events) {
    updated.behavioral_events = updates.behavioral_events;
  }
  // `!== undefined` (not truthiness) so an explicit `null` CLEARS opto (editor disable).
  if (updates.optogenetics !== undefined) {
    updated.optogenetics = updates.optogenetics;
  }

  updated.lastModified = now;
  return updated;
}

/**
 * Append a new configuration snapshot to an animal's history and return the next animal
 * record. The version is `history.length + 1` (sequential). Used by the reconfiguration
 * wizard's create-then-apply flow.
 *
 * @param {object} animal - The current animal record.
 * @param {object} config - `{ date, description, devices }` for the new snapshot.
 * @param {string} now - Timestamp to stamp `lastModified`.
 * @returns {object} The next animal record.
 */
export function addConfigurationSnapshotToAnimal(animal, config, now) {
  const updated = structuredClone(animal);
  const history = getConfigHistory(updated);

  const newVersion = {
    version: history.length + 1,
    date: config.date,
    description: config.description,
    devices: normalizeProbeConfigDevices(config.devices),
    appliedToDays: [],
  };

  updated.configurationHistory = [...history, newVersion];
  updated.lastModified = now;
  return updated;
}

/**
 * Point a set of days at an existing snapshot version and keep each snapshot's
 * `appliedToDays` a clean partition (a day appears in at most one list). Returns the next
 * animal record + the next full days map. Throws if the snapshot version does not exist.
 *
 * @param {object} animal - The current animal record.
 * @param {object} days - The full `days` map (read-only; not mutated).
 * @param {number} snapshotVersion - The existing snapshot version to apply.
 * @param {string[]} dayIds - Day ids to move onto that version.
 * @param {string} now - Timestamp to stamp moved days + the animal.
 * @returns {{ animal: object, days: object }} The next animal + days map.
 * @throws {Error} If `snapshotVersion` does not exist for the animal.
 */
export function applyConfigurationForwardToAnimal(animal, days, snapshotVersion, dayIds, now) {
  const updatedAnimal = structuredClone(animal);
  const history = getConfigHistory(updatedAnimal);
  const target = history.find((s) => s.version === snapshotVersion);
  if (!target) {
    throw new Error(
      `Configuration version "${snapshotVersion}" not found for animal "${animal?.id}"`
    );
  }

  // Only real, deduped days move — a day id not in the workspace must never leak into
  // appliedToDays (which would pollute the usage view).
  const validDayIds = [...new Set(dayIds)].filter((id) => days[id]);
  const moving = new Set(validDayIds);

  // Remove the moving days from EVERY snapshot's list first (clean partition), then add
  // them to the target's list (dedup, stable order).
  history.forEach((snapshot) => {
    snapshot.appliedToDays = (snapshot.appliedToDays || []).filter((id) => !moving.has(id));
  });
  target.appliedToDays = [
    ...target.appliedToDays.filter((id) => !moving.has(id)),
    ...validDayIds,
  ];
  updatedAnimal.configurationHistory = history;

  // Point each listed day at the target version.
  const updatedDays = { ...days };
  validDayIds.forEach((dayId) => {
    updatedDays[dayId] = {
      ...structuredClone(days[dayId]),
      configurationVersion: snapshotVersion,
      lastModified: now,
    };
  });

  updatedAnimal.lastModified = now;
  return { animal: updatedAnimal, days: updatedDays };
}

/**
 * Rebuild a corrupt/missing `configurationHistory` from scratch: a single version-1
 * snapshot derived from the animal's CURRENT `devices`. The executable repair for a
 * `malformed_animal_collection` on `configurationHistory`. Tolerates any start shape.
 *
 * Scope: this clears the raw-shape corruption (the carried command's issue). It does NOT
 * re-pin days that referenced a now-gone version > 1 — those still fail closed in
 * `resolveDayConfig` until re-applied — so it is one step toward export-readiness, not a
 * guarantee of it.
 *
 * @param {object} animal - The current animal record.
 * @param {string} now - Timestamp to stamp `lastModified`.
 * @param {string} today - Date string for the rebuilt snapshot.
 * @returns {object} The next animal record.
 */
export function rebuildConfigurationHistoryForAnimal(animal, now, today) {
  const updated = structuredClone(animal);
  const devices = getAnimalDevices(updated);

  updated.configurationHistory = [
    {
      version: 1,
      date: today,
      description: 'Rebuilt configuration',
      devices: {
        electrode_groups: structuredClone(
          Array.isArray(devices.electrode_groups) ? devices.electrode_groups : []
        ),
        ntrode_electrode_group_channel_map: structuredClone(
          Array.isArray(devices.ntrode_electrode_group_channel_map)
            ? devices.ntrode_electrode_group_channel_map
            : []
        ),
      },
      appliedToDays: [],
    },
  ];
  updated.lastModified = now;
  return updated;
}

/**
 * Build a new recording-day record pinned to the animal's LATEST configuration version, with
 * `technical` seeded from the animal's technical defaults. The caller owns id generation and
 * the existence check.
 *
 * @param {object} animal - The owning animal (for technicalDefaults + the latest pin).
 * @param {string} animalId - The owning animal id.
 * @param {string} dayId - The (already-validated) new day id.
 * @param {string} date - Date in YYYY-MM-DD.
 * @param {object} session - Session metadata (session_id, session_description, etc.).
 * @param {string} now - Timestamp for created/lastModified.
 * @returns {object} The new day record.
 */
export function createDayRecord(animal, animalId, dayId, date, session, now) {
  // Pin to the latest snapshot's ACTUAL version, not the count. An imported/repaired
  // history can be non-contiguous (e.g. [1, 3]) — there the count (2) names no real
  // snapshot, and `resolveDayConfig` (which matches by `version`) would fail closed on a
  // brand-new day. The last element is the latest snapshot everywhere else in the model
  // (mirroring in applyAnimalUpdates, the reconfig latest in DevicesStep).
  const history = getConfigHistory(animal);
  const latestVersion = history.length > 0 ? history[history.length - 1].version : 0;
  return {
    id: dayId,
    animalId,
    date,
    experimentDate: formatExperimentDate(date),
    session: {
      session_id: session.session_id,
      session_description: session.session_description,
      experiment_description: session.experiment_description,
      weight: session.weight,
    },
    keywords: [],
    tasks: [],
    behavioral_events: [],
    associated_files: [],
    associated_video_files: [],
    technical: {
      // Seeded from the animal's technical DEFAULTS (overridable per day); falls back to
      // the standard values when no defaults are set.
      times_period_multiplier: animal.technicalDefaults?.times_period_multiplier ?? 1.5,
      raw_data_to_volts: animal.technicalDefaults?.raw_data_to_volts ?? 0.195,
      default_header_file_path: '',
      units: undefined,
    },
    state: {
      draft: true,
      validated: false,
      exported: false,
    },
    created: now,
    lastModified: now,
    configurationVersion: latestVersion,
  };
}

/**
 * Apply partial updates to a day and return the next day record. A `session` merge guards a
 * malformed CURRENT session (a corrupt import can persist `session` as a scalar/array) to a
 * record before spreading, so `{...'corrupt'}` can't scatter char-indexed keys — the
 * resetDaySession repair relies on this to write a clean session over a malformed one.
 *
 * @param {object} day - The current day record.
 * @param {object} updates - Partial updates.
 * @param {string} now - Timestamp to stamp `lastModified`.
 * @returns {object} The next day record (deep-cloned; input not mutated).
 */
export function applyDayUpdates(day, updates, now) {
  const updated = structuredClone(day);

  if (updates.session) {
    const currentSession =
      updated.session !== null &&
      typeof updated.session === 'object' &&
      !Array.isArray(updated.session)
        ? updated.session
        : {};
    updated.session = { ...currentSession, ...updates.session };
  }
  if (updates.tasks !== undefined) {
    updated.tasks = updates.tasks;
  }
  if (updates.behavioral_events !== undefined) {
    updated.behavioral_events = updates.behavioral_events;
  }
  if (updates.associated_files !== undefined) {
    updated.associated_files = updates.associated_files;
  }
  if (updates.associated_video_files !== undefined) {
    updated.associated_video_files = updates.associated_video_files;
  }
  // FsGUI protocol files are a day-owned collection the export merge reads; without this
  // branch a write (including the resetDayCollection repair) would be silently dropped.
  if (updates.fs_gui_yamls !== undefined) {
    updated.fs_gui_yamls = updates.fs_gui_yamls;
  }
  if (updates.technical) {
    updated.technical = { ...updated.technical, ...updates.technical };
  }
  if (updates.deviceOverrides) {
    updated.deviceOverrides = normalizeDeviceOverrides(updates.deviceOverrides);
  }
  if (updates.state) {
    updated.state = { ...updated.state, ...updates.state };
  }
  // Probe-reconfiguration: point this day at a different snapshot version. Setting it here
  // does NOT reconcile snapshots' `appliedToDays` — use applyConfigurationForward for that.
  if (updates.configurationVersion !== undefined) {
    updated.configurationVersion = updates.configurationVersion;
  }
  if (updates.keywords !== undefined) {
    updated.keywords = updates.keywords;
  }

  updated.lastModified = now;
  return updated;
}
