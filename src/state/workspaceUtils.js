/**
 * @fileoverview Utility functions for workspace operations
 *
 * This module provides pure utility functions for working with animal/day data,
 * particularly the critical mergeDayMetadata function that combines animal defaults
 * with day-specific data to produce complete NWB metadata for YAML export.
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md §5 YAML Export Flow
 */

/**
 * Merges animal defaults with day-specific data to produce complete NWB metadata.
 *
 * This is the MOST CRITICAL function in the workspace architecture - it must produce
 * EXACTLY the same YAML structure as the legacy single-session exporter. Any deviation
 * will corrupt the trodes_to_nwb pipeline and Spyglass database ingestion.
 *
 * Inheritance Rules:
 * - Animal provides: subject, devices, cameras, experimenters, optogenetics (if present)
 * - Day provides: session, tasks, epochs, files, technical parameters
 * - Day OVERRIDES: weight, experiment_description, cameras, electrode_groups (if specified)
 * - Configuration versions: Day references specific probe configuration from animal history
 *
 * @param {import('./workspaceTypes').Animal} animal - Parent animal with shared metadata
 * @param {import('./workspaceTypes').Day} day - Recording day with session-specific data
 * @returns {object} Complete NWB metadata ready for YAML export
 *
 * @example
 * const animal = workspace.animals['remy'];
 * const day = workspace.days['remy-2023-06-22'];
 * const metadata = mergeDayMetadata(animal, day);
 * const yaml = encodeYaml(metadata); // Ready for export
 */
export function mergeDayMetadata(animal, day) {
  // Find the configuration version referenced by this day
  // Falls back to first config if version not found, or latest if version is null
  const config = animal.configurationHistory.find(
    (c) => c.version === day.configurationVersion
  ) || animal.configurationHistory[animal.configurationHistory.length - 1] || animal.configurationHistory[0];

  // Build merged metadata object
  const merged = {
    // === From Animal: Experimenters ===
    experimenter_name: animal.experimenters.experimenter_name,
    lab: animal.experimenters.lab,
    institution: animal.experimenters.institution,

    // === From Day: Session ===
    experiment_description: day.session.experiment_description || '',
    session_description: day.session.session_description,
    session_id: day.session.session_id,
    keywords: [], // Could auto-generate from tasks in future

    // === From Animal: Subject (with day overrides) ===
    subject: {
      ...animal.subject,
      // Weight override: Day weight takes precedence if specified
      weight: day.session.weight !== undefined ? day.session.weight : animal.subject.weight,
    },

    // === From Animal: Data Acquisition ===
    data_acq_device: animal.devices.data_acq_device,
    device: animal.devices.device,

    // === From Animal or Day Override: Cameras ===
    cameras: day.deviceOverrides?.cameras || animal.cameras,

    // === From Configuration Version (or Day Override): Electrode Groups ===
    electrode_groups: day.deviceOverrides?.electrode_groups || config.devices.electrode_groups,
    ntrode_electrode_group_channel_map:
      day.deviceOverrides?.ntrode_electrode_group_channel_map ||
      config.devices.ntrode_electrode_group_channel_map,

    // === From Day: Behavioral Protocol ===
    tasks: day.tasks,
    behavioral_events: day.behavioral_events,

    // === From Day: Data Files ===
    associated_files: day.associated_files,
    associated_video_files: day.associated_video_files,

    // === From Day: Technical Parameters ===
    times_period_multiplier: day.technical.times_period_multiplier,
    raw_data_to_volts: day.technical.raw_data_to_volts,
    default_header_file_path: day.technical.default_header_file_path,
    units: day.technical.units || {},
  };

  // === Conditional: Optogenetics (only if animal has optogenetics) ===
  if (animal.optogenetics) {
    merged.opto_excitation_source = animal.optogenetics.opto_excitation_source;
    merged.optical_fiber = animal.optogenetics.optical_fiber;
    merged.virus_injection = animal.optogenetics.virus_injection;
    merged.optogenetic_stimulation_software = animal.optogenetics.optogenetic_stimulation_software;
  }

  // === Conditional: FsGUI YAMLs (only if day has them) ===
  if (day.fs_gui_yamls && day.fs_gui_yamls.length > 0) {
    merged.fs_gui_yamls = day.fs_gui_yamls;
  }

  return merged;
}

/**
 * Formats date in mmddYYYY format for YAML filename
 *
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} Date in mmddYYYY format
 *
 * @example
 * formatExperimentDate('2023-06-22') // => '06222023'
 */
export function formatExperimentDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${month}${day}${year}`;
}

/**
 * Generates day ID from animal ID and date
 *
 * @param {string} animalId - Animal identifier
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {string} Day ID in format "{animalId}-{date}"
 *
 * @example
 * generateDayId('remy', '2023-06-22') // => 'remy-2023-06-22'
 */
export function generateDayId(animalId, date) {
  return `${animalId}-${date}`;
}

/**
 * Gets current ISO timestamp
 *
 * @returns {string} ISO 8601 timestamp
 *
 * @example
 * getCurrentTimestamp() // => '2023-06-22T14:30:00.000Z'
 */
export function getCurrentTimestamp() {
  return new Date().toISOString();
}

/**
 * Gets current date in YYYY-MM-DD format
 *
 * @returns {string} Date in YYYY-MM-DD format
 *
 * @example
 * getCurrentDate() // => '2023-06-22'
 */
export function getCurrentDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
