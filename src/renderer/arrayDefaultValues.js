/**
 * Default values for arrays entries
 */
const arrayDefaultValues = {
  data_acq_device: {
    name: '',
    system: '',
    amplifier: '',
    adc_circuit: '',
  },
  associated_files: {
    name: '',
    description: '',
    path: '',
    task_epochs: [],
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
    units: 'mm',
  },
  ntrode_electrode_group_channel_map: {
    ntrode_id: 1,
    electrode_group_id: '',
    bad_channels: [],
    map: {},
  },
};

export default arrayDefaultValues;
