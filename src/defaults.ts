/**
 * @fileoverview Default form-state values (split from the legacy `valueList.js`; re-exported by
 * the `valueList` barrel). The initial YML form data, the empty (reset) form data, and the
 * per-array-item default templates the legacy form and array-management helpers seed from.
 */

/**
 * Default YML values
 */
export const defaultYMLValues = {
  experimenter_name: [],
  lab: 'Loren Frank Lab',
  institution: 'University of California, San Francisco',
  experiment_description: '',
  session_description: '',
  session_id: '',
  keywords: [],
  subject: {
    description: 'Long-Evans Rat',
    genotype: '',
    sex: 'M',
    species: 'Rattus norvegicus',
    subject_id: '',
    date_of_birth: '',
    weight: 100,
  },
  data_acq_device: [],
  cameras: [],
  tasks: [],
  associated_files: [],
  associated_video_files: [],
  units: {
    analog: '',
    behavioral_events: '',
  },
  times_period_multiplier: 1.0,
  raw_data_to_volts: 1.0,
  default_header_file_path: '',
  behavioral_events: [],
  device: {
    name: ['Trodes'],
  },
  opto_excitation_source: [],
  optical_fiber: [],
  virus_injection: [],
  fs_gui_yamls: [],
  optogenetic_stimulation_software: "",
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],

};

/**
 * Form data content when empty; used to clear out form
 */
export const emptyFormData = {
  experimenter_name: [],
  lab: '',
  institution: '',
  experiment_description: '',
  session_description: '',
  session_id: '',
  keywords: [],
  subject: {
    description: '',
    genotype: '',
    sex: 'M',
    species: '',
    subject_id: '',
    date_of_birth: '',
    weight: 0,
  },
  data_acq_device: [],
  cameras: [],
  tasks: [],
  associated_files: [],
  associated_video_files: [],
  units: {
    analog: '',
    behavioral_events: '',
  },
  times_period_multiplier: 0.0,
  raw_data_to_volts: 0.0,
  default_header_file_path: '',
  behavioral_events: [],
  device: {
    name: [],
  },
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],
  opto_excitation_source: [],
  virus_injection: [],
  optical_fiber: [],
  fs_gui_yamls: [],
  optogenetic_stimulation_software: '',
};

/**
 * Default values for arrays entries
 */
export const arrayDefaultValues = {
  data_acq_device: {
    name: 'SpikeGadgets',
    system: 'SpikeGadgets',
    amplifier: 'Intan',
    adc_circuit: 'Intan',
  },
  associated_files: {
    name: '',
    description: '',
    path: '',
    task_epochs: '',
  },
  cameras: {
    id: 0,
    meters_per_pixel: 0,
    manufacturer: '',
    model: '',
    lens: '',
    camera_name: '',
  },
  tasks: {
    task_name: '',
    task_description: '',
    task_environment: '',
    camera_id: [],
    task_epochs: [],
  },
  associated_video_files: {
    name: '',
    camera_id: '',
    task_epochs: '',
  },
  behavioral_events: {
    description: 'Din1',
    name: '', // 'Home box camera',
  },
  electrode_groups: {
    id: 0,
    location: '', // 'Cornu ammonis 1 (CA1)',
    device_type: '',
    description: '',
    targeted_location: '', // 'Cornu ammonis 1 (CA1)',
    targeted_x: '',
    targeted_y: '',
    targeted_z: '',
    units: 'μm',
  },
  ntrode_electrode_group_channel_map: {
    ntrode_id: 1,
    electrode_group_id: '',
    bad_channels: [],
    map: {},
  },

  opto_excitation_source: {
    name: 'Omicron LuxX+ Blue',
    model_name: 'Omicron LuxX+ 488-100',
    description: 'Laser for optogenetic stimulation',
    wavelength_in_nm: 488.0,
    power_in_W: 0.077,
    intensity_in_W_per_m2: 1e10,
  },

  optical_fiber: {
    name: 'Optical fiber 1',
    hardware_name : '',
    implanted_fiber_description: '',
    location : '',
    hemisphere : '',
    ap_in_mm : 0.0,
    ml_in_mm : 0.0,
    dv_in_mm : 0.0,
    roll_in_deg :0.0,
    pitch_in_deg : 0.0,
    yaw_in_deg : 0.0,
    reference : 'Bregma at the cortical surface',
    excitation_source   : '',
  },

  virus_injection: {
    name: 'Injection 1',
    description : 'Viral injection for optogenetic stimulation',
    hemisphere : '',
    location : '',
    ap_in_mm : 0.0,
    ml_in_mm : 0.0,
    dv_in_mm : 0.0,
    roll_in_deg : 0.0,
    pitch_in_deg : 0.0,
    yaw_in_deg : 0.0,
    reference : 'Bregma at the cortical surface',
    virus_name: '',
    titer_in_vg_per_ml : 1e12,
    volume_in_uL : 0.45,
  },

  fs_gui_yamls: {
    name: '/path/to/fs_gui.yaml',
    epochs: [],
    power_in_mW: 0.0,
    dio_output_name: "",
    state_script_parameters: false,
    pulseLength: 0,
  },

  optogenetic_stimulation_software: "fsgui",
};
