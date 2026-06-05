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
  // Lossless: an integer / exact integer-string becomes its canonical string form
  // ("2"→"2"); anything else ("2.9", "abc") is preserved verbatim so a corrupt
  // bad-channel-override key is NOT silently rerouted onto a real ntrode (e.g.
  // "2.9" must not collapse onto ntrode "2"). Validation/schema then flags it.
  const parsed = parseExactInteger(value);
  return Number.isInteger(parsed) ? String(parsed) : String(value);
}

/**
 * Exact integer parser — the heart of the Normalization Contract.
 *
 * Accepts a value that is genuinely an integer or an EXACT integer-string
 * (a clean persisted-state migration, e.g. `"2"` → `2`) and returns the
 * integer. Anything else — a non-integer number (`2.9`), an inexact string
 * (`"2.9"`, `"abc"`, `""`), `null`, `undefined`, or any non-scalar — is
 * returned UNCHANGED. It is never coerced and never replaced with a
 * synthesized fallback.
 *
 * This is deliberate: the export/merge/load normalizer must NOT launder
 * corrupt persisted state into a plausible integer. Preserving the raw value
 * lets the downstream schema (AJV `type: integer`) and the channel-bound rules
 * (which test `Number.isInteger`) flag the corruption instead of silently
 * "fixing" it into valid-looking YAML.
 *
 * @param {*} value - Candidate id / map key / map value.
 * @returns {*} The integer when the input is an integer or exact integer-string;
 *   otherwise the original value, unchanged.
 */
export function parseExactInteger(value) {
  if (typeof value === 'number') {
    // A non-integer number (2.9) is preserved so it reaches schema/rules.
    return value;
  }
  if (typeof value === 'string') {
    // Exact integer-string only: optional leading sign, digits, nothing else.
    // Rejects "2.9", "2px", " 2", "", "0x10", "1e3", etc. so they survive to
    // schema/rules. Number(...) of an exact integer-string is a safe integer here
    // for any realistic id/channel magnitude.
    if (/^[+-]?\d+$/.test(value)) {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) return parsed;
    }
    return value;
  }
  return value;
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

/**
 * Normalize a list of integer indices (e.g. `bad_channels`) STRICTLY and
 * LOSSLESSLY, matching the channel-map value contract: an exact integer /
 * integer-string is coerced and de-duplicated; a corrupt entry (`2.9`, `"abc"`)
 * is PRESERVED as-is so the channel-bound rules flag it instead of silently
 * flooring `2.9` to `2`. Absent entries (`null` / `undefined` / `""`) are dropped.
 *
 * @param {*} value - Candidate index list.
 * @returns {Array} Normalized list (integers de-duped; corrupt entries preserved).
 */
function normalizeNumberList(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const out = [];
  value.forEach((item) => {
    if (item == null || item === '') return;
    const parsed = parseExactInteger(item);
    if (Number.isInteger(parsed)) {
      if (!seen.has(parsed)) {
        seen.add(parsed);
        out.push(parsed);
      }
    } else {
      out.push(parsed); // corrupt → preserved for validation to surface
    }
  });
  return out;
}

/**
 * Normalize an ntrode channel map STRICTLY and LOSSLESSLY.
 *
 * A key or value that is an integer or exact integer-string becomes the integer
 * (clean migration). Anything else (`"2.9"`, `"abc"`) is PRESERVED as-is — it is
 * never coerced (no `parseInt("2.9")` → `2` data loss) and never dropped — so the
 * channel-bound validation rules (which test `Number.isInteger` / probe-electrode
 * membership) flag the corrupt entry instead of it exporting as plausible YAML.
 *
 * @param {object} map - Raw map object (logical channel → probe electrode id).
 * @returns {object} Map with exact-integer entries coerced, everything else preserved.
 */
function normalizeMap(map) {
  if (!isPlainObject(map)) return {};

  return Object.entries(map).reduce((acc, [key, value]) => {
    // Object keys are always strings; coerce an exact integer-string key to an
    // integer (which re-stringifies identically, preserving byte output), but keep
    // a non-integer key (e.g. "abc") so the key-range rule can flag it.
    const normalizedKey = parseExactInteger(key);
    acc[normalizedKey] = parseExactInteger(value);
    return acc;
  }, {});
}

/**
 * Build the schema-shaped portion of an electrode group (no id resolution).
 * Shared by the strict export normalizer and the creation-defaults variant.
 *
 * @param source
 * @param root0
 * @param root0.synthesizeText
 * @private
 */
function buildElectrodeGroupBody(source, { synthesizeText }) {
  const location = cleanString(source.location);
  const id = source.id;
  const rawDescription = cleanString(source.description);
  const rawTargeted = cleanString(source.targeted_location);

  const description = synthesizeText
    ? rawDescription || location || `Electrode group ${Number.isInteger(id) ? id : 0}`
    : rawDescription;
  const targetedLocation = synthesizeText
    ? rawTargeted || location || description
    : rawTargeted;

  const normalized = {
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

/**
 * STRICT export/load normalization of an electrode group.
 *
 * Coerces a clean integer-string `id` to an integer (`"2"` → `2`) but PRESERVES a
 * corrupt `id` (`"abc"`, `"2.9"`) unchanged so AJV's `type: integer` flags it.
 * Crucially, it does NOT synthesize a `description`/`targeted_location` from
 * `location`: a missing/empty required field is left empty so the existing
 * `empty_targeted_location` / schema-required rules fire. Trimming is fine;
 * invention is not.
 *
 * The legacy `fallbackId` parameter is accepted for call-site compatibility but
 * intentionally IGNORED — a missing id is no longer back-filled from the array
 * index (that laundered corrupt state into a plausible integer).
 *
 * @param {object} group - Raw electrode group.
 * @param {number} [_fallbackId] - Ignored. Retained for signature compatibility.
 * @returns {object} Strictly-normalized group (corrupt fields preserved for validation).
 */
export function normalizeElectrodeGroup(group = {}, _fallbackId = 0) {
  const source = isPlainObject(group) ? group : {};
  return {
    id: parseExactInteger(source.id),
    ...buildElectrodeGroupBody(source, { synthesizeText: false }),
  };
}

/**
 * CREATION-path normalization of an electrode group.
 *
 * Identical schema shape to {@link normalizeElectrodeGroup}, but for code that is
 * CREATING a new group (editor / copy / generated maps) it may legitimately need a
 * default id and default text. Synthesis lives HERE, never in the export/load
 * normalizer.
 *
 * @param {object} group - Raw electrode group being created.
 * @param {number} [fallbackId] - Default integer id when the group has none.
 * @returns {object} Normalized group with creation defaults applied.
 */
export function normalizeElectrodeGroupWithDefaults(group = {}, fallbackId = 0) {
  const source = isPlainObject(group) ? group : {};
  const exactId = parseExactInteger(source.id);
  const id = Number.isInteger(exactId) ? exactId : fallbackId;
  return {
    id,
    ...buildElectrodeGroupBody({ ...source, id }, { synthesizeText: true }),
  };
}

/**
 * STRICT export/load normalization of an ntrode channel-map row.
 *
 * Coerces clean integer-string ids to integers; PRESERVES corrupt ids and corrupt
 * map keys/values unchanged so schema/rules flag them. `fallback*` parameters are
 * accepted for call-site compatibility but IGNORED (no index back-fill).
 *
 * @param {object} ntrode - Raw ntrode row.
 * @param {number} [_fallbackNtrodeId] - Ignored.
 * @param {number} [_fallbackGroupId] - Ignored.
 * @returns {object} Strictly-normalized ntrode (corrupt fields preserved).
 */
export function normalizeNtrodeMap(ntrode = {}, _fallbackNtrodeId = 0, _fallbackGroupId = 0) {
  const source = isPlainObject(ntrode) ? ntrode : {};

  return {
    ntrode_id: parseExactInteger(source.ntrode_id),
    electrode_group_id: parseExactInteger(source.electrode_group_id),
    bad_channels: normalizeNumberList(source.bad_channels),
    map: normalizeMap(source.map),
  };
}

/**
 * CREATION-path normalization of an ntrode channel-map row.
 *
 * Applies default integer ids when absent. Used by editor/copy code that is
 * creating new ntrode rows.
 *
 * @param {object} ntrode - Raw ntrode row being created.
 * @param {number} [fallbackNtrodeId] - Default ntrode_id when absent.
 * @param {number} [fallbackGroupId] - Default electrode_group_id when absent.
 * @returns {object} Normalized ntrode with creation defaults applied.
 */
export function normalizeNtrodeMapWithDefaults(
  ntrode = {},
  fallbackNtrodeId = 0,
  fallbackGroupId = 0
) {
  const source = isPlainObject(ntrode) ? ntrode : {};
  const exactNtrodeId = parseExactInteger(source.ntrode_id);
  const exactGroupId = parseExactInteger(source.electrode_group_id);

  return {
    ntrode_id: Number.isInteger(exactNtrodeId) ? exactNtrodeId : fallbackNtrodeId,
    electrode_group_id: Number.isInteger(exactGroupId) ? exactGroupId : fallbackGroupId,
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
      ? source.electrode_groups.map((group) => normalizeElectrodeGroup(group))
      : [],
    ntrode_electrode_group_channel_map: Array.isArray(source.ntrode_electrode_group_channel_map)
      ? source.ntrode_electrode_group_channel_map.map((ntrode) => normalizeNtrodeMap(ntrode))
      : [],
  };
}

export function normalizeProbeConfigDevices(devices = {}) {
  const source = isPlainObject(devices) ? devices : {};

  return {
    electrode_groups: Array.isArray(source.electrode_groups)
      ? source.electrode_groups.map((group) => normalizeElectrodeGroup(group))
      : [],
    ntrode_electrode_group_channel_map: Array.isArray(source.ntrode_electrode_group_channel_map)
      ? source.ntrode_electrode_group_channel_map.map((ntrode) => normalizeNtrodeMap(ntrode))
      : [],
  };
}

export function normalizeDeviceOverrides(overrides) {
  if (!isPlainObject(overrides)) return overrides;
  const normalized = { ...structuredClone(overrides) };

  if (Array.isArray(overrides.electrode_groups)) {
    normalized.electrode_groups = overrides.electrode_groups.map((group) =>
      normalizeElectrodeGroup(group)
    );
  }

  if (Array.isArray(overrides.ntrode_electrode_group_channel_map)) {
    normalized.ntrode_electrode_group_channel_map =
      overrides.ntrode_electrode_group_channel_map.map((ntrode) => normalizeNtrodeMap(ntrode));
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
