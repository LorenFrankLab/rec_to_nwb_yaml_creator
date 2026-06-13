/**
 * @fileoverview Type definitions for Animal Workspace data model.
 *
 * This module defines the data structures for multi-animal, multi-day workspace management.
 *
 * This file is the source of truth for the workspace data model. It implements the
 * inheritance model where:
 * - Animals hold shared metadata (subject, devices, experimenters)
 * - Days hold session-specific data (tasks, epochs, files)
 * - YAML export merges Animal defaults + Day specifics (see {@link module:state/workspaceUtils})
 *
 * Types are compile-time only; this module emits no runtime code.
 */

/** Animal ID - unique identifier for an animal (e.g. "remy", "bean"). */
export type AnimalId = string;

/** Day ID - unique identifier for a recording day (e.g. "remy-2023-06-22"). */
export type DayId = string;

/**
 * Top-level container for all animals and days.
 *
 * Persisted to localStorage (key "rec_to_nwb_workspace_v1", debounced autosave) when
 * the persistence feature flag is enabled. Contains all animals, days, and settings.
 */
export interface Workspace {
  /** Schema version (e.g., "1.0.0"). */
  version: string;
  /** ISO timestamp of last modification. */
  lastModified: string;
  /** All animals keyed by ID. */
  animals: Record<AnimalId, Animal>;
  /** All days keyed by ID. */
  days: Record<DayId, Day>;
  /** Global workspace settings. */
  settings: WorkspaceSettings;
}

/**
 * Real workspace save/load status exposed by the store.
 *
 * Derived only from actual persistence outcomes (never optimistic). Surfaced on the
 * store return and via StoreContext as `persistence`. Never part of the form `model`
 * and never serialized into YAML.
 *
 * Note: `lastSaved` here is the storage-write timestamp and is unrelated to
 * `Workspace.version` (the in-memory data-model version) or the persisted envelope's
 * integer `schemaVersion` (the storage-format version that governs hydrate/discard).
 */
export interface PersistenceStatus {
  /** Whether localStorage persistence is active (feature flag). */
  enabled: boolean;
  /** ISO timestamp of the last confirmed write, or null. */
  lastSaved: string | null;
  /** Message if the last write failed, or null. */
  saveError: string | null;
  /** True while a debounced write is in flight. */
  hasPendingWrite: boolean;
  /** Notice shown when a saved workspace was discarded, or null. */
  loadNotice: string | null;
  /** Clears the load notice. */
  dismissLoadNotice: () => void;
}

/**
 * Shared metadata across all recording days.
 *
 * Represents a single subject with all metadata that remains constant
 * or changes infrequently across recording sessions.
 */
export interface Animal {
  /** Unique animal identifier. */
  id: AnimalId;
  /** Subject information. */
  subject: SubjectMetadata;
  /** Hardware configuration. */
  devices: DeviceConfiguration;
  /** Camera setup. */
  cameras: Camera[];
  /** Lab and experimenter details. */
  experimenters: ExperimenterInfo;
  /**
   * Animal-level default experiment description. A day with no per-session
   * `experiment_description` inherits this in the export merge (the OverviewStep
   * "leave blank to use animal's default" hint). Optional; defaults to `''`.
   */
  experiment_description?: string;
  /** Defaults copied into new days. */
  technicalDefaults: TechnicalDefaults;
  /**
   * Optional optogenetics setup. An explicit `null` is the editor's "disabled" sentinel
   * (written by `applyAnimalUpdates` on `optogenetics: null`); readers treat `null` and
   * `undefined` alike (both falsy). See {@link module:state/workspaceTransitions}.
   */
  optogenetics?: OptogeneticsConfig | null;
  /**
   * VESTIGIAL animal-level behavioral-events (DIO) library. Behavioral events are now
   * day-owned (`Day.behavioral_events`, the only ones exported); this field is retained in
   * the persisted blob for backward/forward compatibility and is still written by
   * `applyAnimalUpdates` so the editor and the model agree. No longer read by the export.
   * See {@link module:state/workspaceSelectors} `getAnimalBehavioralEvents`.
   */
  behavioral_events?: BehavioralEvent[];
  /**
   * Animal-level task-type catalog (define-once, pick/order per day). Each `TaskType`
   * is defined once for the animal and referenced from days via `Day.taskInstances`.
   *
   * **Phase 8B (rehearsal): OPTIONAL and inert.** The catalog model utilities exist and
   * are tested, but the running app and the export merge still read inline `Day.tasks`.
   * Phase 8C activates this as the source of truth (persisted shape bump + migrator + UI).
   * Runtime readers must remain tolerant of its absence.
   *
   * @see module:state/taskCatalog
   */
  taskTypes?: TaskType[];
  /** Ordered list of day IDs for this animal. */
  days: DayId[];
  /** ISO timestamp when animal was created. */
  created: string;
  /** ISO timestamp of last modification. */
  lastModified: string;
  /** Probe reconfiguration tracking. */
  configurationHistory: ConfigurationSnapshot[];
}

/** Information about the experimental subject. */
export interface SubjectMetadata {
  /** Subject identifier (e.g., "remy"). */
  subject_id: string;
  /** Species name (e.g., "Rattus norvegicus"). */
  species: string;
  /** Biological sex. */
  sex: 'M' | 'F' | 'U' | 'O';
  /** Genetic background. */
  genotype: string;
  /** ISO datetime string. */
  date_of_birth: string;
  /** Subject description. */
  description: string;
  /**
   * Animal BASELINE weight in grams (optional). This is an initial/fallback value
   * only; the per-session exported weight is the day-owned `SessionMetadata.weight`,
   * which the export prefers over this baseline.
   */
  weight?: number;
  /** Age string (optional, computed from DOB). */
  age?: string;
}

/** Hardware setup for recording. */
export interface DeviceConfiguration {
  /** Data acquisition devices. */
  data_acq_device: DataAcqDevice[];
  /** Device names. */
  device: { name: string[] };
  /** Electrode group configurations. */
  electrode_groups: ElectrodeGroup[];
  /** Channel mappings. */
  ntrode_electrode_group_channel_map: NtrodeMap[];
}

/** Data acquisition device information. */
export interface DataAcqDevice {
  /** Device name. */
  name: string;
  /** System identifier. */
  system: string;
  /** Amplifier type. */
  amplifier: string;
  /** ADC circuit type. */
  adc_circuit: string;
}

/** Electrode group configuration. */
export interface ElectrodeGroup {
  /** Electrode group ID. */
  id: number;
  /** Brain region (e.g., "CA1"). */
  location: string;
  /** Probe type (e.g., "tetrode_12.5"). */
  device_type: string;
  /** Group description. */
  description: string;
  /** Stereotaxic coordinates [AP, ML, DV]. */
  targeted_location?: number[];
  /** X coordinate. */
  targeted_x?: string;
  /** Y coordinate. */
  targeted_y?: string;
  /** Z coordinate. */
  targeted_z?: string;
}

/** Ntrode electrode channel mapping. */
export interface NtrodeMap {
  /** Ntrode identifier. */
  ntrode_id: number;
  /** Associated electrode group. */
  electrode_group_id: number;
  /** Channel index mappings (e.g., {0: 0, 1: 1, 2: 2, 3: 3}). */
  map: Record<string, number>;
  /** List of bad channel indices. */
  bad_channels: number[];
}

/** Camera configuration. */
export interface Camera {
  /** Camera ID. */
  id: number;
  /** Calibration value. */
  meters_per_pixel: number;
  /** Camera manufacturer. */
  manufacturer: string;
  /** Camera model. */
  model: string;
  /** Lens description. */
  lens?: string;
  /** Legacy camera name field. */
  camera_name?: number;
}

/** Experimenter information. */
export interface ExperimenterInfo {
  /** List of experimenter names. */
  experimenter_name: string[];
  /** Lab name. */
  lab: string;
  /** Institution name. */
  institution: string;
}

/** Optogenetics configuration (optional). */
export interface OptogeneticsConfig {
  /** Light sources. */
  opto_excitation_source: OptoExcitationSource[];
  /** Fiber implants. */
  optical_fiber: OpticalFiber[];
  /** Viral vector injections. */
  virus_injection: VirusInjection[];
  /** Software used. */
  optogenetic_stimulation_software: string;
}

/** Opto excitation source configuration. */
export interface OptoExcitationSource {
  /** Light source name. */
  name: string;
  /** Wavelength in nm. */
  wavelength: number;
  /** Power in mW. */
  power: number;
  /** Additional description. */
  description?: string;
}

/** Optical fiber configuration. */
export interface OpticalFiber {
  /** Fiber name. */
  name: string;
  /** Target brain region. */
  location: string;
  /** Stereotaxic coordinates [AP, ML, DV]. */
  coordinates: number[];
  /** Additional description. */
  description?: string;
}

/** Virus injection configuration. */
export interface VirusInjection {
  /** Viral vector name. */
  virus_name: string;
  /** Injection site. */
  location: string;
  /** Stereotaxic coordinates [AP, ML, DV]. */
  coordinates: number[];
  /** Injection volume in nL. */
  volume: number;
  /** Additional description. */
  description?: string;
}

/**
 * Tracks probe configuration changes over time.
 *
 * When probe positions are adjusted, a new configuration version is created.
 * Days reference configuration versions to track which probe setup was active.
 *
 * **Invariant:** across an animal's `configurationHistory`, the `appliedToDays`
 * lists are disjoint — each day id appears in at most one snapshot's list.
 * `applyConfigurationForwardToAnimal` maintains this partition; `reconcileAppliedToDays`
 * derives the trustworthy view from each day's version regardless.
 */
export interface ConfigurationSnapshot {
  /** Date this config became active (YYYY-MM-DD). */
  date: string;
  /** Sequential version number (1, 2, 3, ...). */
  version: number;
  /** Change description (e.g., "Lowered CA1 tetrodes by 40um"). */
  description: string;
  /** Probe and channel configuration. */
  devices: ProbeConfiguration;
  /**
   * Days that use this configuration. This is a denormalized cache; the authoritative
   * source is each `Day.configurationVersion` (derive the trustworthy view with
   * `reconcileAppliedToDays`).
   */
  appliedToDays: DayId[];
}

/** Probe configuration for a snapshot. */
export interface ProbeConfiguration {
  /** Electrode group positions. */
  electrode_groups: ElectrodeGroup[];
  /** Channel mappings. */
  ntrode_electrode_group_channel_map: NtrodeMap[];
}

/**
 * Structured diff between two {@link ProbeConfiguration}s, as produced by
 * `diffProbeConfigs`. Electrode groups are matched by `id`, ntrodes by `ntrode_id`;
 * all arrays are sorted for deterministic rendering.
 *
 * **Invariant:** `hasChanges` is true iff any of the six add/remove/changed arrays
 * is non-empty (it is always derived, never set independently).
 */
export interface ProbeConfigDiff {
  electrodeGroups: {
    added: ElectrodeGroup[];
    removed: ElectrodeGroup[];
    changed: Array<{ id: number; fields: string[]; before: ElectrodeGroup; after: ElectrodeGroup }>;
  };
  channelMaps: {
    added: NtrodeMap[];
    removed: NtrodeMap[];
    changed: Array<{
      ntrode_id: number;
      electrode_group_id: number;
      mapChanged: boolean;
      badChannelsChanged: boolean;
      before: NtrodeMap;
      after: NtrodeMap;
    }>;
  };
  /** True iff any add/remove/changed entry exists. */
  hasChanges: boolean;
}

/**
 * Session-specific metadata for a single recording day.
 *
 * Contains all data unique to a recording session. When exported as YAML,
 * day data is merged with animal defaults to produce a complete NWB metadata file.
 */
export interface Day {
  /** Unique day identifier (e.g., "remy-2023-06-22"). */
  id: DayId;
  /** Parent animal ID. */
  animalId: AnimalId;
  /** Recording date (YYYY-MM-DD). */
  date: string;
  /** Date in mmddYYYY format (for filename). */
  experimentDate: string;
  /** ISO datetime of session start. */
  sessionStartTime?: string;
  /** Session-specific metadata. */
  session: SessionMetadata;
  /** Optional searchable keyword tags (NWB keywords). */
  keywords?: string[];
  /** Behavioral tasks (inline model — the current runtime/export source of truth). */
  tasks: Task[];
  /**
   * Ordered references into the animal's `taskTypes` catalog, one per task this day ran,
   * each carrying the day's own `task_epochs`. The catalog counterpart of inline `tasks`.
   *
   * **Phase 8B (rehearsal): OPTIONAL and inert.** Present only on data produced by the
   * (un-registered) v2→v3 conversion utility; the export merge still resolves from inline
   * `tasks`. Phase 8C makes this the source of truth. `mergeDayMetadata` will resolve each
   * instance back to an inline `tasks[]` entry (see {@link module:state/taskCatalog}).
   */
  taskInstances?: TaskInstance[];
  /** DIO events. */
  behavioral_events: BehavioralEvent[];
  /** Data files. */
  associated_files: AssociatedFile[];
  /** Video files. */
  associated_video_files: AssociatedVideoFile[];
  /** FsGUI protocol files. */
  fs_gui_yamls?: FsGuiYaml[];
  /** Day-owned set of camera ids used this session. */
  cameras_used?: Array<number | string>;
  /** Day-owned name referencing the animal's recording-system catalog entry. */
  data_acq_device_name?: string;
  /** Technical recording parameters. */
  technical: TechnicalParameters;
  /** Device overrides (if different from animal default). */
  deviceOverrides?: DeviceOverrides;
  /** Workspace state (draft, validated, exported). */
  state: DayState;
  /** ISO timestamp when day was created. */
  created: string;
  /** ISO timestamp of last modification. */
  lastModified: string;
  /** Links to Animal.configurationHistory version. */
  configurationVersion: number;
}

/** Session metadata for a day. */
export interface SessionMetadata {
  /** Session identifier (e.g., "remy_20230622"). */
  session_id: string;
  /** Session description. */
  session_description: string;
  /** Optional override of animal default. */
  experiment_description?: string;
  /** Subject weight override for this day. */
  weight?: number;
}

/** Behavioral task configuration. */
export interface Task {
  /** Task name. */
  task_name: string;
  /** Task description. */
  task_description: string;
  /** Epoch numbers for this task. */
  task_epochs: number[];
  /** Camera IDs used in task. */
  camera_id?: string[];
  /** Environment description. */
  task_environment?: string;
}

/**
 * Animal-level task-type catalog entry (define-once, reuse-per-day).
 *
 * A `TaskType` carries the per-name task DEFINITION (everything that does not vary by day);
 * a day references it by `id` via {@link TaskInstance} and supplies only that day's
 * `task_epochs`. The dedup key is `task_name` — the Spyglass dataset-unique identity
 * (`common_task.py` raises on a duplicate `task_name` with a different `task_description`),
 * so one `TaskType` per name makes that divergence structurally impossible.
 *
 * **Phase 8B: model-only.** Produced by the (un-registered) v2→v3 conversion utility and
 * consumed by the catalog resolution/validation helpers; not yet persisted or exported.
 */
export interface TaskType {
  /**
   * Stable internal id (e.g. "tasktype-0"); never exported. Uniqueness within an animal's
   * `taskTypes` is a PRODUCER-maintained invariant (the type cannot express it) — the conversion
   * mints sequential ids and the resolver/validator key Maps on it; Phase 8C should add an
   * import-boundary uniqueness assertion (the persistence-migrator defense-in-depth discipline).
   */
  id: string;
  /** Task name — the catalog dedup key (Spyglass identity). */
  task_name: string;
  /** Task description. */
  task_description: string;
  /** Environment description (preserved as present/absent for byte-identical resolution). */
  task_environment?: string;
  /**
   * Camera IDs used by this task type (animal-level). Deliberately `Array<number | string>`: this
   * is a tolerant-READ boundary type that must survive corrupt v2 imports (cameras can arrive as a
   * stray string; cf. {@link module:state/cameraUsage}). The schema (`nwb_schema.json`) is an
   * integer array — do NOT narrow this to `number[]` to "match" it; let validation reject bad data.
   * Phase 8C should converge this, `Task.camera_id`, and {@link TaskDefinitionFields.camera_id} on
   * one shared `CameraId = number | string` alias rather than tightening the storage type.
   */
  camera_id?: Array<number | string>;
}

/**
 * Ordered per-day reference into the animal's `taskTypes` catalog.
 *
 * Mirrors the camera pattern (`animal.cameras` catalog + per-day reference): the day picks
 * which task types it ran and orders their epochs; it does not re-type definitions. The
 * export bridge resolves `{ taskTypeId, task_epochs }` back to an inline `tasks[]` entry of
 * exactly the five `TASK_ORDER` keys (see {@link module:state/taskCatalog}).
 */
export interface TaskInstance {
  /** References {@link TaskType.id} on the owning animal. */
  taskTypeId: string;
  /** Epoch numbers for this task on this day. */
  task_epochs: number[];
}

/**
 * Record of a migration-time task-definition conflict, preserved for user review.
 *
 * When a later day reuses a `task_name` with a DIFFERENT definition, the canonical
 * (first-occurrence) `TaskType` wins for determinism and this record captures the day's
 * ORIGINAL definition vs the canonical one — the original values are never silently
 * dropped. Surfaced as a repairable `task_definition_reconciled` issue.
 */
export interface TaskDefinitionReconciliation {
  /** The conflicting task name. */
  task_name: string;
  /** The canonical TaskType this day was pointed at. */
  taskTypeId: string;
  /** The day's original (pre-normalization) definition fields, present-keys only. */
  original: TaskDefinitionFields;
  /** The canonical (first-occurrence) definition fields, present-keys only. */
  canonical: TaskDefinitionFields;
}

/** The Spyglass-identity definition fields compared when reconciling a `task_name`. */
export interface TaskDefinitionFields {
  /** Task description. */
  task_description?: string;
  /** Environment description. */
  task_environment?: string;
  /** Camera IDs used by the task. */
  camera_id?: Array<number | string>;
}

/** Behavioral event (DIO event) configuration. */
export interface BehavioralEvent {
  /** Event name. */
  name: string;
  /** Event description. */
  description: string;
}

/** Associated file metadata. */
export interface AssociatedFile {
  /** File name. */
  name: string;
  /** File description. */
  description: string;
  /** File path. */
  path: string;
  /** Associated task epoch. */
  task_epochs?: number | string;
}

/** Associated video file metadata. */
export interface AssociatedVideoFile {
  /** Video file name. */
  name: string;
  /** Camera ID. */
  camera_id: number;
  /** Associated task epoch. */
  task_epochs?: number | string;
}

/** FsGUI YAML configuration. */
export interface FsGuiYaml {
  /** Protocol name. */
  name: string;
  /** File path. */
  path: string;
  /** Associated task epoch. */
  task_epochs: number | string;
}

/**
 * Animal-level technical defaults copied into newly created days.
 *
 * These are not exported directly; day.technical is the export source of truth.
 */
export interface TechnicalDefaults {
  /** Default timestamp multiplier for new days. */
  times_period_multiplier: number;
  /** Default ADC conversion factor for new days. */
  raw_data_to_volts: number;
}

/** Technical recording parameters. */
export interface TechnicalParameters {
  /** Timestamp multiplier. */
  times_period_multiplier: number;
  /** ADC conversion factor. */
  raw_data_to_volts: number;
  /** Header file path. */
  default_header_file_path: string;
  /** Unit specifications. */
  units?: Units;
}

/** Unit specifications. */
export interface Units {
  /** Analog unit. */
  analog: string;
  /** Behavioral event unit. */
  behavioral_events: string;
}

/**
 * Device overrides for a specific day.
 *
 * Probe/bad-channel overrides for a specific day. Cameras remain animal-level
 * (`animal.cameras`) and are not overridden here.
 */
export interface DeviceOverrides {
  /** Override electrode groups. */
  electrode_groups?: ElectrodeGroup[];
  /** Override channel maps. */
  ntrode_electrode_group_channel_map?: NtrodeMap[];
  /**
   * Day-owned per-ntrode bad-channel marks, keyed by ntrode_id (string); the SOLE
   * owner of bad channels (the merge reads these, never the snapshot base).
   */
  bad_channels?: Record<string, number[]>;
}

/**
 * Day workflow state.
 *
 * Tracks the current state of a day through the editing workflow.
 */
export interface DayState {
  /** true if editing in progress, false if ready to export. */
  draft: boolean;
  /** true if passed validation pipeline. */
  validated: boolean;
  /** true if YAML file generated. */
  exported: boolean;
  /** ISO timestamp of export. */
  exportedAt?: string;
  /** Current validation errors. */
  validationErrors?: ValidationIssue[];
  /**
   * Off-export acknowledgments of deliberate bad-channel un-marks, keyed by ntrode id
   * (string); lives ONLY in state, never read by the export merge.
   */
  badChannelRemovalAcks?: Record<string, number[]>;
  /**
   * Task-definition conflicts recorded when the v2→v3 task-catalog conversion normalized
   * a day's reused `task_name` to the canonical definition. Preserves the original values
   * for review (surfaced as `task_definition_reconciled`); never read by the export merge.
   *
   * **Phase 8B: written only by the un-registered conversion utility; inert at runtime.**
   */
  taskDefinitionReconciliations?: TaskDefinitionReconciliation[];
}

/** Validation issue. */
export interface ValidationIssue {
  /** Field path (e.g., "tasks[0].task_name"). */
  field: string;
  /** Error message. */
  message: string;
  /** Issue severity. */
  severity: 'error' | 'warning';
}

/** Workspace settings. */
export interface WorkspaceSettings {
  /** Default lab name for new animals. */
  defaultLab: string;
  /** Default institution for new animals. */
  defaultInstitution: string;
  /** Default experimenters for new animals. */
  defaultExperimenters: string[];
  /** Auto-save interval in milliseconds (default: 30000). */
  autoSaveInterval: number;
  /** Enable shadow export comparison (default: true). */
  shadowExportEnabled: boolean;
}
