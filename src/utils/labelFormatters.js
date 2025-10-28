/**
 * Utility functions for formatting array item labels consistently across
 * component summaries and navigation sidebar.
 *
 * These functions provide a single source of truth for how array items are
 * labeled, ensuring consistency between the form components and navigation.
 */

/**
 * Format electrode group label
 * @param {object} item - Electrode group object
 * @param {number} item.id - Electrode group ID
 * @param {string} item.location - Brain region location
 * @returns {string} Formatted label: "Electrode Group {id} - {location}"
 */
export const formatElectrodeGroupLabel = (item) => {
  return `Electrode Group ${item.id} - ${item.location || 'Unnamed'}`;
};

/**
 * Format camera label
 * @param {object} item - Camera object
 * @param {number} item.id - Camera ID
 * @param {string} item.camera_name - Camera name
 * @returns {string} Formatted label: "Camera {id} - {camera_name}"
 */
export const formatCameraLabel = (item) => {
  return `Camera ${item.id} - ${item.camera_name || 'Unnamed'}`;
};

/**
 * Format task label
 * @param {object} item - Task object
 * @param {string} item.task_name - Task name
 * @returns {string} Formatted label: "Task: {task_name}"
 */
export const formatTaskLabel = (item) => {
  return `Task: ${item.task_name || 'Unnamed'}`;
};

/**
 * Format behavioral event label
 * @param {object} item - Behavioral event object
 * @param {string} item.name - Event name
 * @returns {string} Formatted label: "Event: {name}"
 */
export const formatBehavioralEventLabel = (item) => {
  return `Event: ${item.name || 'Unnamed'}`;
};

/**
 * Format data acquisition device label
 * @param {object} item - Data acq device object
 * @param {string} item.name - Device name
 * @returns {string} Formatted label: "Device: {name}"
 */
export const formatDataAcqDeviceLabel = (item) => {
  return `Device: ${item.name || 'Unnamed'}`;
};

/**
 * Format associated file label
 * @param {object} item - Associated file object
 * @param {string} item.name - File name
 * @returns {string} Formatted label: "File: {name}"
 */
export const formatAssociatedFileLabel = (item) => {
  return `File: ${item.name || 'Unnamed'}`;
};

/**
 * Format associated video file label
 * @param {object} item - Associated video file object
 * @param {string} item.name - Video file name
 * @returns {string} Formatted label: "Video: {name}"
 */
export const formatAssociatedVideoLabel = (item) => {
  return `Video: ${item.name || 'Unnamed'}`;
};

/**
 * Format optogenetics excitation source label
 * @param {object} item - Opto excitation source object
 * @param {string} item.name - Source name
 * @param {number} item.wavelength_in_nm - Wavelength in nanometers
 * @returns {string} Formatted label: "Source: {name} - {wavelength}nm"
 */
export const formatOptoSourceLabel = (item) => {
  const wavelength = item.wavelength_in_nm ? ` - ${item.wavelength_in_nm}nm` : '';
  return `Source: ${item.name || 'Unnamed'}${wavelength}`;
};

/**
 * Format optical fiber label
 * @param {object} item - Optical fiber object
 * @param {string} item.name - Fiber name
 * @param {string} item.location - Implant location
 * @returns {string} Formatted label: "Fiber: {name} - {location}"
 */
export const formatOpticalFiberLabel = (item) => {
  const location = item.location ? ` - ${item.location}` : '';
  return `Fiber: ${item.name || 'Unnamed'}${location}`;
};

/**
 * Format virus injection label
 * @param {object} item - Virus injection object
 * @param {string} item.name - Injection name
 * @param {string} item.location - Injection location
 * @returns {string} Formatted label: "Injection: {name} - {location}"
 */
export const formatVirusInjectionLabel = (item) => {
  const location = item.location ? ` - ${item.location}` : '';
  return `Injection: ${item.name || 'Unnamed'}${location}`;
};

/**
 * Format FsGUI YAML label
 * @param {object} item - FsGUI YAML object
 * @param {string} item.name - FsGUI file name
 * @returns {string} Formatted label: "FsGUI: {name}"
 */
export const formatFsGuiLabel = (item) => {
  return `FsGUI: ${item.name || 'Unnamed'}`;
};
