/* eslint-disable jsdoc/require-jsdoc */

const DEFAULT_DEVICE_NAME = 'Trodes';

const EMPTY_DEVICES = {
  data_acq_device: [],
  device: { name: [DEFAULT_DEVICE_NAME] },
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeIdKey(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? String(value) : String(parsed);
}

function toInteger(value, fallback = 0) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function toNonNegativeInteger(value, fallback = 0) {
  return Math.max(0, toInteger(value, fallback));
}

function cleanString(value) {
  if (value == null) return '';
  return String(value).trim();
}

function toFiniteNumber(value) {
  if (value == null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function normalizeNumberList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .map((item) => toFiniteNumber(item))
      .filter((item) => item !== undefined)
      .map((item) => Number.parseInt(item, 10))
  )];
}

function normalizeMap(map) {
  if (!isPlainObject(map)) return {};

  return Object.entries(map).reduce((acc, [key, value]) => {
    const parsedKey = Number.parseInt(key, 10);
    const parsedValue = Number.parseInt(value, 10);
    if (!Number.isNaN(parsedKey) && !Number.isNaN(parsedValue)) {
      acc[parsedKey] = parsedValue;
    }
    return acc;
  }, {});
}

export function normalizeElectrodeGroup(group = {}, fallbackId = 0) {
  const source = isPlainObject(group) ? group : {};
  const id = toNonNegativeInteger(source.id, fallbackId);
  const location = cleanString(source.location);
  const description = cleanString(source.description) || location || `Electrode group ${id}`;
  const targetedLocation = cleanString(source.targeted_location) || location || description;

  const normalized = {
    id,
    location,
    device_type: cleanString(source.device_type),
    description,
    targeted_location: targetedLocation,
  };

  const targetedX = toFiniteNumber(source.targeted_x);
  const targetedY = toFiniteNumber(source.targeted_y);
  const targetedZ = toFiniteNumber(source.targeted_z);
  const units = cleanString(source.units);

  if (targetedX !== undefined) normalized.targeted_x = targetedX;
  if (targetedY !== undefined) normalized.targeted_y = targetedY;
  if (targetedZ !== undefined) normalized.targeted_z = targetedZ;
  if (units) normalized.units = units;

  return normalized;
}

export function normalizeNtrodeMap(ntrode = {}, fallbackNtrodeId = 0, fallbackGroupId = 0) {
  const source = isPlainObject(ntrode) ? ntrode : {};

  return {
    ntrode_id: toNonNegativeInteger(source.ntrode_id, fallbackNtrodeId),
    electrode_group_id: toNonNegativeInteger(source.electrode_group_id, fallbackGroupId),
    bad_channels: normalizeNumberList(source.bad_channels),
    map: normalizeMap(source.map),
  };
}

function normalizeDeviceName(device) {
  const names = Array.isArray(device?.name)
    ? device.name.map(cleanString).filter(Boolean)
    : [];

  return { name: names.length > 0 ? names : [DEFAULT_DEVICE_NAME] };
}

export function normalizeDevices(devices = {}) {
  const source = isPlainObject(devices) ? devices : {};

  return {
    data_acq_device: Array.isArray(source.data_acq_device)
      ? structuredClone(source.data_acq_device)
      : [],
    device: normalizeDeviceName(source.device),
    electrode_groups: Array.isArray(source.electrode_groups)
      ? source.electrode_groups.map((group, index) => normalizeElectrodeGroup(group, index))
      : [],
    ntrode_electrode_group_channel_map: Array.isArray(source.ntrode_electrode_group_channel_map)
      ? source.ntrode_electrode_group_channel_map.map((ntrode, index) =>
          normalizeNtrodeMap(ntrode, index)
        )
      : [],
  };
}

export function normalizeProbeConfigDevices(devices = {}) {
  const source = isPlainObject(devices) ? devices : {};

  return {
    electrode_groups: Array.isArray(source.electrode_groups)
      ? source.electrode_groups.map((group, index) => normalizeElectrodeGroup(group, index))
      : [],
    ntrode_electrode_group_channel_map: Array.isArray(source.ntrode_electrode_group_channel_map)
      ? source.ntrode_electrode_group_channel_map.map((ntrode, index) =>
          normalizeNtrodeMap(ntrode, index)
        )
      : [],
  };
}

export function normalizeDeviceOverrides(overrides) {
  if (!isPlainObject(overrides)) return overrides;
  const normalized = { ...structuredClone(overrides) };

  if (Array.isArray(overrides.electrode_groups)) {
    normalized.electrode_groups = overrides.electrode_groups.map((group, index) =>
      normalizeElectrodeGroup(group, index)
    );
  }

  if (Array.isArray(overrides.ntrode_electrode_group_channel_map)) {
    normalized.ntrode_electrode_group_channel_map =
      overrides.ntrode_electrode_group_channel_map.map((ntrode, index) =>
        normalizeNtrodeMap(ntrode, index)
      );
  }

  if (isPlainObject(overrides.bad_channels)) {
    normalized.bad_channels = Object.fromEntries(
      Object.entries(overrides.bad_channels).map(([ntrodeId, channels]) => [
        normalizeIdKey(ntrodeId),
        normalizeNumberList(channels),
      ])
    );
  }

  return normalized;
}

export function normalizeWorkspaceDevices(workspace) {
  if (!isPlainObject(workspace)) return workspace;

  const normalized = structuredClone(workspace);
  const animals = normalized.animals || {};

  Object.values(animals).forEach((animal) => {
    if (!isPlainObject(animal)) return;

    animal.devices = normalizeDevices(animal.devices || EMPTY_DEVICES);

    if (Array.isArray(animal.configurationHistory)) {
      animal.configurationHistory = animal.configurationHistory.map((snapshot) => ({
        ...snapshot,
        devices: normalizeProbeConfigDevices(snapshot.devices || {}),
      }));
    }
  });

  Object.values(normalized.days || {}).forEach((day) => {
    if (!isPlainObject(day)) return;

    if (day.deviceOverrides) {
      day.deviceOverrides = normalizeDeviceOverrides(day.deviceOverrides);
    }
  });

  return normalized;
}
