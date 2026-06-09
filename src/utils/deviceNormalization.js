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

/**
 * Trim a string field WITHOUT laundering a corrupt non-string into a plausible
 * value. A real string is trimmed; `null`/`undefined` become `''` (absent); a
 * non-string (e.g. `location: 123`, `units: 7`, an object) is PRESERVED as-is so
 * the schema's `type: string` check surfaces the corruption instead of
 * `String(123)` → `"123"` slipping through (Normalization Contract).
 *
 * @param {*} value - Candidate string field.
 * @returns {*} Trimmed string, '' for absent, or the original non-string value.
 */
function cleanString(value) {
  if (value == null) return '';
  if (typeof value !== 'string') return value;
  return value.trim();
}

/**
 * Coerce a numeric field STRICTLY: a finite number stays; an EXACT numeric string
 * (`"2.5"`) migrates to the number; anything else — a non-finite number, junk like
 * `"2.5mm"`, or a non-scalar — is PRESERVED unchanged so the schema's numeric type
 * check flags it (no `parseFloat("2.5mm")` → `2.5` laundering). `null`/`undefined`/
 * `''` return `undefined` so the field is omitted and the schema's `required` check
 * surfaces the absence.
 *
 * @param {*} value - Candidate numeric field.
 * @returns {*} The number, the preserved corrupt value, or `undefined` when absent.
 */
function toFiniteNumber(value) {
  if (value == null || value === '') return undefined;
  if (typeof value === 'number') return value; // finite stays; NaN/Inf preserved for schema
  if (typeof value === 'string' && /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(value.trim())) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return value; // preserve corrupt (e.g. "2.5mm") for the schema to flag
}

/**
 * Normalize a list of integer indices (e.g. `bad_channels`) STRICTLY and
 * LOSSLESSLY, matching the channel-map value contract: an exact integer /
 * integer-string is coerced and de-duplicated; a corrupt entry (`2.9`, `"abc"`)
 * is PRESERVED as-is so the channel-bound rules flag it instead of silently
 * flooring `2.9` to `2`. Absent entries (`null` / `undefined` / `""`) are dropped.
 *
 * A non-array, non-absent value (e.g. `bad_channels: "2.9"`) is PRESERVED VERBATIM
 * — NOT coerced to a clean `[]` — so the schema's `type: array` check surfaces the
 * corruption instead of it silently vanishing (the channel rules / DevicesStep
 * already guard iteration with `Array.isArray`, so a preserved scalar can't crash).
 *
 * @param {*} value - Candidate index list.
 * @returns {*} Normalized array (integers de-duped; corrupt entries preserved), `[]`
 *   for an absent value, or the original non-array value preserved for validation.
 */
function normalizeNumberList(value) {
  if (value == null) return []; // absent → clean empty default (byte-parity)
  if (!Array.isArray(value)) return value; // corrupt non-array → preserved for schema
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

/**
 * Select the configuration snapshot a day resolves against, EXACTLY mirroring
 * `resolveDayConfig`'s selection so the migration and the merge agree:
 *  - a day that pins a `configurationVersion` resolves THAT snapshot by `version`;
 *  - an unpinned day (no `configurationVersion`) resolves the LATEST snapshot.
 * Returns `null` when there is no usable snapshot (no history, or a pin with no
 * matching version) — the migration then leaves the day to the existing repair path.
 *
 * @param {object} animal - The animal record.
 * @param {object} day - The day record.
 * @returns {object|null} The matching snapshot, or `null` when none resolves.
 */
function selectSnapshotForDay(animal, day) {
  const history = Array.isArray(animal?.configurationHistory)
    ? animal.configurationHistory
    : [];
  if (history.length === 0) return null;

  const hasPin = day?.configurationVersion != null;
  const snapshot = hasPin
    ? history.find((c) => c && c.version === day.configurationVersion)
    : history[history.length - 1];

  return isPlainObject(snapshot) ? snapshot : null;
}

/**
 * One-time, idempotent, load-time MIGRATION: move config-snapshot ("base")
 * bad-channel marks DOWN into each day's `deviceOverrides.bad_channels`, making
 * bad channels day-owned WITHOUT changing the exported YAML for any existing data
 * when fed through the UNCHANGED `resolveDayConfig` merge.
 *
 * `resolveDayConfig` applies bad-channels with REPLACE (not union) semantics: for
 * each ntrode, the effective `bad_channels` is the day override for that
 * `ntrode_id` IF present and well-formed, ELSE the snapshot base. The migration
 * preserves that per-ntrode resolution exactly:
 *  - For each ntrode in the day's resolved snapshot: if the day override ALREADY
 *    has that `ntrode_id` key, leave it untouched (the override already wins —
 *    this also preserves a corrupt scalar override verbatim, never laundering it).
 *    Otherwise, if the snapshot base `bad_channels` for that ntrode is a non-empty
 *    array, set `day.deviceOverrides.bad_channels[ntrodeId]` to a copy of it.
 *  - Then strip `bad_channels` off a snapshot's ntrode rows (set to `[]`) ONLY
 *    once EVERY dependent day has materialized that base. A snapshot's base is
 *    shared by every day pinned to its version. A day BLOCKS its snapshot's strip
 *    when its override cannot materialize the base without loss or laundering —
 *    either (1) `deviceOverrides.bad_channels` is a CORRUPT non-record container
 *    (the merge ignores it wholesale and reads the base), or (2) the container is
 *    a record but a non-empty-base ntrode carries a present NON-array override
 *    value (the merge declines it and keeps the base, and overwriting it would
 *    launder the corruption). A blocked snapshot's base is kept intact so the
 *    unchanged merge keeps exporting it for all days on that snapshot (byte-identical).
 *
 * Net effect with the unchanged merge: an ntrode that had an override still
 * resolves to that override; an ntrode that relied on base now resolves to the
 * moved override (base is `[]`) → SAME effective set → byte-identical export.
 *
 * It is a NO-OP when no snapshot carries non-empty base `bad_channels` (the
 * overwhelming majority of fixtures), which is also the idempotency guarantee:
 * after one run the snapshots are base-free, so a second run does nothing.
 *
 * Shape-safe: a missing/corrupt animal or snapshot, or a non-array snapshot ntrode
 * map, is skipped (left to the existing repair path), never crashed on. Operates on
 * an already-cloned `normalized` workspace — the caller owns the clone.
 *
 * @param {object} normalized - An ALREADY-CLONED workspace (mutated in place).
 * @returns {object} The same workspace, with base marks moved down.
 */
/**
 * Stable key for a snapshot in the block-set: a day's resolved `(animalId, version)`.
 * Mirrors how a day selects its snapshot, so every day landing on the SAME snapshot
 * version shares the same key.
 *
 * @param {string} animalId - The day's animal id.
 * @param {*} version - The resolved snapshot's `version`.
 * @returns {string} Composite block-set key.
 */
function snapshotKey(animalId, version) {
  return `${animalId} ${version}`;
}

function applyBadChannelMigration(normalized) {
  if (!isPlainObject(normalized)) return normalized;
  const animals = normalized.animals || {};
  const days = normalized.days || {};

  // A snapshot's base is shared by EVERY day pinned to its version, and the merge
  // applies a day override with REPLACE semantics. A base is therefore only safe to
  // strip once EVERY dependent day has materialized that base into a writable
  // (record) override — otherwise a day that couldn't materialize it would fall
  // through to the (now-stripped) base and silently lose its marks. TWO distinct
  // shapes block a snapshot's strip (both keep the base intact so the unchanged
  // merge keeps exporting it for all days on that snapshot):
  //   1. CORRUPT CONTAINER — `deviceOverrides.bad_channels` is a non-record
  //      (e.g. scalar "2.9"): the merge ignores it wholesale and reads the base, so
  //      the base cannot be materialized into a readable override.
  //   2. CORRUPT NON-ARRAY VALUE on a BASED ntrode — the container is a record but
  //      a non-empty-base ntrode's override value is present and NOT an array
  //      (e.g. { 1: "2.9" } over base [2]): the merge DECLINES the non-array value
  //      and keeps the base, and we must NOT overwrite the corrupt value with the
  //      base (that would launder the corruption the repair path needs to surface).
  // Two passes:
  //   Pass 1 — materialize base→day-override for materializable days, and record
  //            the resolved (animalId, version) of any day that can't.
  //   Pass 2 — strip a snapshot's base ONLY if no dependent day blocked it.
  const blockedSnapshots = new Set();

  // Pass 1: materialize + detect blockers (per day).
  Object.values(days).forEach((day) => {
    if (!isPlainObject(day)) return;
    const animal = animals[day.animalId];
    if (!isPlainObject(animal)) return; // missing/corrupt animal → repair path

    const snapshot = selectSnapshotForDay(animal, day);
    if (!snapshot) return; // no usable snapshot (no history / dangling pin)

    const baseNtrodes = snapshot.devices?.ntrode_electrode_group_channel_map;
    if (!Array.isArray(baseNtrodes)) return; // corrupt snapshot map → repair path

    // Collect the base marks to move down, keyed by canonical ntrode_id string.
    const toMove = [];
    baseNtrodes.forEach((ntrode) => {
      if (!isPlainObject(ntrode)) return;
      const base = ntrode.bad_channels;
      if (Array.isArray(base) && base.length > 0) {
        toMove.push([normalizeIdKey(ntrode.ntrode_id), base]);
      }
    });

    if (toMove.length === 0) return; // no base to move — NO-OP (idempotency)

    // A corrupt non-record override container CANNOT be safely materialized — the
    // merge ignores it wholesale and reads the snapshot base. Record this day's
    // resolved snapshot as blocked so Pass 2 leaves its base intact, and do NOT
    // write into the corrupt container (leave it for the repair path).
    const existing = day.deviceOverrides?.bad_channels;
    if (existing != null && !isPlainObject(existing)) {
      blockedSnapshots.add(snapshotKey(day.animalId, snapshot.version));
      return;
    }

    // The container is a record (or absent). A CORRUPT NON-ARRAY value on a BASED
    // ntrode (present, non-array, over a non-empty base) blocks the strip: the merge
    // DECLINES the non-array value and keeps the base, so stripping that base would
    // make the merge fall back to [] and silently lose the marks. We must NOT
    // materialize the base into that ntrode either — overwriting the corrupt value
    // would launder the very corruption the repair path needs to surface. So block
    // this snapshot's strip (base kept intact → byte-identical via the merge), while
    // still materializing the OTHER (clean / absent-key) based ntrodes below.
    const hasCorruptValueOnBasedNtrode = toMove.some(([ntrodeId]) => {
      if (!isPlainObject(existing)) return false; // absent container → nothing corrupt
      if (!Object.hasOwn(existing, ntrodeId)) return false; // absent key → materializable
      return !Array.isArray(existing[ntrodeId]); // present non-array value → corrupt
    });
    if (hasCorruptValueOnBasedNtrode) {
      blockedSnapshots.add(snapshotKey(day.animalId, snapshot.version));
    }

    // Materialize base→override for each ntrode the override lacks, ensuring the
    // override container is a record.
    if (!isPlainObject(day.deviceOverrides)) {
      day.deviceOverrides = {};
    }
    if (!isPlainObject(day.deviceOverrides.bad_channels)) {
      day.deviceOverrides.bad_channels = {};
    }
    const target = day.deviceOverrides.bad_channels;
    toMove.forEach(([ntrodeId, base]) => {
      // REPLACE precedence: an existing override (incl. a corrupt non-array value) wins —
      // never overwrite it, never launder it. Only an ABSENT key is materialized.
      if (!Object.hasOwn(target, ntrodeId)) {
        target[ntrodeId] = [...base];
      }
    });
  });

  // Pass 2: strip each snapshot's base ONLY if no dependent day blocked it. A
  // blocked snapshot keeps its base, so the unchanged merge keeps exporting that
  // base for every day on it → byte-identical.
  Object.entries(animals).forEach(([animalId, animal]) => {
    if (!isPlainObject(animal)) return;
    const history = Array.isArray(animal.configurationHistory)
      ? animal.configurationHistory
      : [];
    history.forEach((snapshot) => {
      if (!isPlainObject(snapshot)) return;
      if (blockedSnapshots.has(snapshotKey(animalId, snapshot.version))) return;

      const baseNtrodes = snapshot.devices?.ntrode_electrode_group_channel_map;
      if (!Array.isArray(baseNtrodes)) return;
      baseNtrodes.forEach((ntrode) => {
        if (
          isPlainObject(ntrode) &&
          Array.isArray(ntrode.bad_channels) &&
          ntrode.bad_channels.length > 0
        ) {
          ntrode.bad_channels = [];
        }
      });
    });
  });

  return normalized;
}

/**
 * Public migration entry: deep-clones the workspace, then moves config-snapshot
 * bad-channel marks down into each day (see {@link applyBadChannelMigration}).
 * A no-op (deep-equal clone) for a base-free workspace. Idempotent.
 *
 * @param {object} workspace - Workspace to migrate (not mutated).
 * @returns {object} A migrated deep clone (or the input unchanged when not an object).
 */
export function migrateBadChannelsToDays(workspace) {
  if (!isPlainObject(workspace)) return workspace;
  return applyBadChannelMigration(structuredClone(workspace));
}

export function normalizeWorkspaceDevices(workspace) {
  if (!isPlainObject(workspace)) return workspace;

  const normalized = structuredClone(workspace);
  const animals = normalized.animals || {};

  Object.values(animals).forEach((animal) => {
    if (!isPlainObject(animal)) return;

    // Capture a corrupt (present-but-non-array) data_acq_device BEFORE normalizing: the
    // raw-state contract requires persisted corruption to survive hydration so raw-shape
    // validation can surface its repair banner. normalizeDevices would otherwise launder it
    // to [] here (at load), silently hiding the corruption — exactly what the contract
    // forbids. A corrupt configurationHistory is already preserved below (the Array.isArray
    // guard leaves a non-array untouched), and animal.cameras is top-level (never normalized
    // here), so data_acq_device is the only laundering gap to close.
    const rawDevices = isPlainObject(animal.devices) ? animal.devices : {};
    const rawDataAcq = rawDevices.data_acq_device;

    animal.devices = normalizeDevices(animal.devices || EMPTY_DEVICES);

    if (rawDataAcq != null && !Array.isArray(rawDataAcq)) {
      animal.devices.data_acq_device = rawDataAcq;
    }

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

  // After per-snapshot / per-day normalization, move any config-snapshot base
  // bad-channel marks DOWN into the owning day's overrides (a no-op for the
  // base-free majority). Runs last so the moved values come from already-
  // normalized snapshots and land in already-normalized override records.
  return applyBadChannelMigration(normalized);
}
