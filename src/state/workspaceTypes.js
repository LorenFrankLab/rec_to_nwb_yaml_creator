/**
 * @fileoverview Type definitions for Animal Workspace data model.
 *
 * This module defines the data structures for multi-animal, multi-day workspace management.
 * Types are defined using JSDoc for gradual type adoption without build system changes.
 *
 * Based on ANIMAL_WORKSPACE_DESIGN.md - implements the inheritance model where:
 * - Animals hold shared metadata (subject, devices, experimenters)
 * - Days hold session-specific data (tasks, epochs, files)
 * - YAML export merges Animal defaults + Day specifics
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for complete architecture
 */

/**
 * Animal ID - unique identifier for an animal
 * @typedef {string} AnimalId
 * @example "remy", "bean"
 */

/**
 * Day ID - unique identifier for a recording day
 * @typedef {string} DayId
 * @example "remy-2023-06-22", "bean-2023-07-15"
 */

/**
 * Workspace - Top-level container for all animals and days
 *
 * Persisted to localStorage with auto-save functionality.
 * Contains all animals, days, and workspace settings.
 *
 * @typedef {object} Workspace
 * @property {string} version - Schema version (e.g., "1.0.0")
 * @property {string} lastModified - ISO timestamp of last modification
 * @property {Record<AnimalId, Animal>} animals - All animals keyed by ID
 * @property {Record<DayId, Day>} days - All days keyed by ID
 * @property {WorkspaceSettings} settings - Global workspace settings
 */

/**
 * Animal - Shared metadata across all recording days
 *
 * Represents a single subject with all metadata that remains constant
 * or changes infrequently across recording sessions.
 *
 * @typedef {object} Animal
 * @property {AnimalId} id - Unique animal identifier
 * @property {SubjectMetadata} subject - Subject information
 * @property {DeviceConfiguration} devices - Hardware configuration
 * @property {Camera[]} cameras - Camera setup
 * @property {ExperimenterInfo} experimenters - Lab and experimenter details
 * @property {OptogeneticsConfig} [optogenetics] - Optional optogenetics setup
 * @property {DayId[]} days - Ordered list of day IDs for this animal
 * @property {string} created - ISO timestamp when animal was created
 * @property {string} lastModified - ISO timestamp of last modification
 * @property {ConfigurationSnapshot[]} configurationHistory - Probe reconfiguration tracking
 */

/**
 * Subject metadata - information about the experimental subject
 *
 * @typedef {object} SubjectMetadata
 * @property {string} subject_id - Subject identifier (e.g., "remy")
 * @property {string} species - Species name (e.g., "Rattus norvegicus")
 * @property {"M"|"F"|"U"|"O"} sex - Biological sex
 * @property {string} genotype - Genetic background
 * @property {string} date_of_birth - ISO datetime string
 * @property {string} description - Subject description
 * @property {number} [weight] - Weight in grams (optional, may change daily)
 * @property {string} [age] - Age string (optional, computed from DOB)
 */

/**
 * Device configuration - hardware setup for recording
 *
 * @typedef {object} DeviceConfiguration
 * @property {DataAcqDevice[]} data_acq_device - Data acquisition devices
 * @property {{name: string[]}} device - Device names
 * @property {ElectrodeGroup[]} electrode_groups - Electrode group configurations
 * @property {NtrodeMap[]} ntrode_electrode_group_channel_map - Channel mappings
 */

/**
 * Data acquisition device information
 *
 * @typedef {object} DataAcqDevice
 * @property {string} name - Device name
 * @property {string} system - System identifier
 * @property {string} amplifier - Amplifier type
 * @property {string} adc_circuit - ADC circuit type
 */

/**
 * Electrode group configuration
 *
 * @typedef {object} ElectrodeGroup
 * @property {number} id - Electrode group ID
 * @property {string} location - Brain region (e.g., "CA1")
 * @property {string} device_type - Probe type (e.g., "tetrode_12.5")
 * @property {string} description - Group description
 * @property {number[]} [targeted_location] - Stereotaxic coordinates [AP, ML, DV]
 * @property {string} [targeted_x] - X coordinate
 * @property {string} [targeted_y] - Y coordinate
 * @property {string} [targeted_z] - Z coordinate
 */

/**
 * Ntrode electrode channel mapping
 *
 * @typedef {object} NtrodeMap
 * @property {number} ntrode_id - Ntrode identifier
 * @property {number} electrode_group_id - Associated electrode group
 * @property {Record<string, number>} map - Channel index mappings (e.g., {0: 0, 1: 1, 2: 2, 3: 3})
 * @property {number[]} bad_channels - List of bad channel indices
 */

/**
 * Camera configuration
 *
 * @typedef {object} Camera
 * @property {number} id - Camera ID
 * @property {number} meters_per_pixel - Calibration value
 * @property {string} manufacturer - Camera manufacturer
 * @property {string} model - Camera model
 * @property {string} [lens] - Lens description
 * @property {number} [camera_name] - Legacy camera name field
 */

/**
 * Experimenter information
 *
 * @typedef {object} ExperimenterInfo
 * @property {string[]} experimenter_name - List of experimenter names
 * @property {string} lab - Lab name
 * @property {string} institution - Institution name
 */

/**
 * Optogenetics configuration (optional)
 *
 * @typedef {object} OptogeneticsConfig
 * @property {OptoExcitationSource[]} opto_excitation_source - Light sources
 * @property {OpticalFiber[]} optical_fiber - Fiber implants
 * @property {VirusInjection[]} virus_injection - Viral vector injections
 * @property {string} optogenetic_stimulation_software - Software used
 */

/**
 * Opto excitation source configuration
 *
 * @typedef {object} OptoExcitationSource
 * @property {string} name - Light source name
 * @property {number} wavelength - Wavelength in nm
 * @property {number} power - Power in mW
 * @property {string} [description] - Additional description
 */

/**
 * Optical fiber configuration
 *
 * @typedef {object} OpticalFiber
 * @property {string} name - Fiber name
 * @property {string} location - Target brain region
 * @property {number[]} coordinates - Stereotaxic coordinates [AP, ML, DV]
 * @property {string} [description] - Additional description
 */

/**
 * Virus injection configuration
 *
 * @typedef {object} VirusInjection
 * @property {string} virus_name - Viral vector name
 * @property {string} location - Injection site
 * @property {number[]} coordinates - Stereotaxic coordinates [AP, ML, DV]
 * @property {number} volume - Injection volume in nL
 * @property {string} [description] - Additional description
 */

/**
 * Configuration snapshot - tracks probe configuration changes over time
 *
 * When probe positions are adjusted, a new configuration version is created.
 * Days reference configuration versions to track which probe setup was active.
 *
 * @typedef {object} ConfigurationSnapshot
 * @property {string} date - Date this config became active (YYYY-MM-DD)
 * @property {number} version - Sequential version number (1, 2, 3, ...)
 * @property {string} description - Change description (e.g., "Lowered CA1 tetrodes by 40um")
 * @property {ProbeConfiguration} devices - Probe and channel configuration
 * @property {DayId[]} appliedToDays - Days that use this configuration
 */

/**
 * Probe configuration for a snapshot
 *
 * @typedef {object} ProbeConfiguration
 * @property {ElectrodeGroup[]} electrode_groups - Electrode group positions
 * @property {NtrodeMap[]} ntrode_electrode_group_channel_map - Channel mappings
 */

/**
 * Day - Session-specific metadata for a single recording day
 *
 * Contains all data unique to a recording session. When exported as YAML,
 * day data is merged with animal defaults to produce a complete NWB metadata file.
 *
 * @typedef {object} Day
 * @property {DayId} id - Unique day identifier (e.g., "remy-2023-06-22")
 * @property {AnimalId} animalId - Parent animal ID
 * @property {string} date - Recording date (YYYY-MM-DD)
 * @property {string} experimentDate - Date in mmddYYYY format (for filename)
 * @property {string} [sessionStartTime] - ISO datetime of session start
 * @property {SessionMetadata} session - Session-specific metadata
 * @property {Task[]} tasks - Behavioral tasks
 * @property {BehavioralEvent[]} behavioral_events - DIO events
 * @property {AssociatedFile[]} associated_files - Data files
 * @property {AssociatedVideoFile[]} associated_video_files - Video files
 * @property {FsGuiYaml[]} [fs_gui_yamls] - FsGUI protocol files
 * @property {TechnicalParameters} technical - Technical recording parameters
 * @property {DeviceOverrides} [deviceOverrides] - Device overrides (if different from animal default)
 * @property {DayState} state - Workspace state (draft, validated, exported)
 * @property {string} created - ISO timestamp when day was created
 * @property {string} lastModified - ISO timestamp of last modification
 * @property {number} configurationVersion - Links to Animal.configurationHistory version
 */

/**
 * Session metadata for a day
 *
 * @typedef {object} SessionMetadata
 * @property {string} session_id - Session identifier (e.g., "remy_20230622")
 * @property {string} session_description - Session description
 * @property {string} [experiment_description] - Optional override of animal default
 * @property {number} [weight] - Subject weight override for this day
 */

/**
 * Behavioral task configuration
 *
 * @typedef {object} Task
 * @property {string} task_name - Task name
 * @property {string} task_description - Task description
 * @property {number[]} task_epochs - Epoch numbers for this task
 * @property {string[]} [camera_id] - Camera IDs used in task
 * @property {string} [task_environment] - Environment description
 */

/**
 * Behavioral event (DIO event) configuration
 *
 * @typedef {object} BehavioralEvent
 * @property {string} name - Event name
 * @property {string} description - Event description
 */

/**
 * Associated file metadata
 *
 * @typedef {object} AssociatedFile
 * @property {string} name - File name
 * @property {string} description - File description
 * @property {string} path - File path
 * @property {number|string} [task_epochs] - Associated task epoch
 */

/**
 * Associated video file metadata
 *
 * @typedef {object} AssociatedVideoFile
 * @property {string} name - Video file name
 * @property {number} camera_id - Camera ID
 * @property {number|string} [task_epochs] - Associated task epoch
 */

/**
 * FsGUI YAML configuration
 *
 * @typedef {object} FsGuiYaml
 * @property {string} name - Protocol name
 * @property {string} path - File path
 * @property {number|string} task_epochs - Associated task epoch
 */

/**
 * Technical recording parameters
 *
 * @typedef {object} TechnicalParameters
 * @property {number} times_period_multiplier - Timestamp multiplier
 * @property {number} raw_data_to_volts - ADC conversion factor
 * @property {string} default_header_file_path - Header file path
 * @property {Units} [units] - Unit specifications
 */

/**
 * Unit specifications
 *
 * @typedef {object} Units
 * @property {string} analog - Analog unit
 * @property {string} behavioral_events - Behavioral event unit
 */

/**
 * Device overrides for a specific day
 *
 * If a day has different device configuration than the animal default,
 * these overrides are used instead of the animal's configuration.
 *
 * @typedef {object} DeviceOverrides
 * @property {ElectrodeGroup[]} [electrode_groups] - Override electrode groups
 * @property {NtrodeMap[]} [ntrode_electrode_group_channel_map] - Override channel maps
 * @property {Camera[]} [cameras] - Override cameras
 */

/**
 * Day workflow state
 *
 * Tracks the current state of a day through the editing workflow.
 *
 * @typedef {object} DayState
 * @property {boolean} draft - true if editing in progress, false if ready to export
 * @property {boolean} validated - true if passed validation pipeline
 * @property {boolean} exported - true if YAML file generated
 * @property {string} [exportedAt] - ISO timestamp of export
 * @property {ValidationIssue[]} [validationErrors] - Current validation errors
 */

/**
 * Validation issue
 *
 * @typedef {object} ValidationIssue
 * @property {string} field - Field path (e.g., "tasks[0].task_name")
 * @property {string} message - Error message
 * @property {"error"|"warning"} severity - Issue severity
 */

/**
 * Workspace settings
 *
 * @typedef {object} WorkspaceSettings
 * @property {string} defaultLab - Default lab name for new animals
 * @property {string} defaultInstitution - Default institution for new animals
 * @property {string[]} defaultExperimenters - Default experimenters for new animals
 * @property {number} autoSaveInterval - Auto-save interval in milliseconds (default: 30000)
 * @property {boolean} shadowExportEnabled - Enable shadow export comparison (default: true)
 */

// Export empty object to make this a module
export {};
