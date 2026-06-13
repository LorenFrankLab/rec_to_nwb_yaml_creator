/* eslint-disable jsdoc/require-jsdoc */

import type {
  DeviceConfiguration,
  DeviceOverrides,
  ElectrodeGroup,
  NtrodeMap,
  ProbeConfiguration,
} from '../state/workspaceTypes';

const DEFAULT_DEVICE_NAME = 'Trodes';

const EMPTY_DEVICES = {
  data_acq_device: [],
  device: { name: [DEFAULT_DEVICE_NAME] },
  electrode_groups: [],
  ntrode_electrode_group_channel_map: [],
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function normalizeIdKey(value: unknown): string {
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
 * @param value - Candidate id / map key / map value.
 * @returns The integer when the input is an integer or exact integer-string;
 *   otherwise the original value, unchanged.
 */
export function parseExactInteger(value: unknown): unknown {
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
 * @param value - Candidate string field.
 * @returns Trimmed string, '' for absent, or the original non-string value.
 */
function cleanString(value: unknown): unknown {
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
 * @param value - Candidate numeric field.
 * @returns The number, the preserved corrupt value, or `undefined` when absent.
 */
function toFiniteNumber(value: unknown): unknown {
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
 * @param value - Candidate index list.
 * @returns Normalized array (integers de-duped; corrupt entries preserved), `[]`
 *   for an absent value, or the original non-array value preserved for validation.
 */
function normalizeNumberList(value: unknown): unknown {
  if (value == null) return []; // absent → clean empty default (byte-parity)
  if (!Array.isArray(value)) return value; // corrupt non-array → preserved for schema
  const seen = new Set<unknown>();
  const out: unknown[] = [];
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
 * @param map - Raw map object (logical channel → probe electrode id).
 * @returns Map with exact-integer entries coerced, everything else preserved.
 */
function normalizeMap(map: unknown): Record<string, unknown> {
  if (!isPlainObject(map)) return {};

  return Object.entries(map).reduce((acc, [key, value]) => {
    // Object keys are always strings; coerce an exact integer-string key to an
    // integer (which re-stringifies identically, preserving byte output), but keep
    // a non-integer key (e.g. "abc") so the key-range rule can flag it.
    const normalizedKey = parseExactInteger(key);
    acc[normalizedKey as string] = parseExactInteger(value);
    return acc;
  }, {} as Record<string, unknown>);
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
function buildElectrodeGroupBody(
  source: Record<string, unknown>,
  { synthesizeText }: { synthesizeText: boolean }
): Record<string, unknown> {
  const location = cleanString(source.location);
  const id = source.id;
  const rawDescription = cleanString(source.description);
  const rawTargeted = cleanString(source.targeted_location);

  const description = synthesizeText
    ? rawDescription || location || `Electrode group ${Number.isInteger(id) ? (id as number) : 0}`
    : rawDescription;
  const targetedLocation = synthesizeText
    ? rawTargeted || location || description
    : rawTargeted;

  const normalized: Record<string, unknown> = {
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
 * @param group - Raw electrode group.
 * @param [_fallbackId] - Ignored. Retained for signature compatibility.
 * @returns Strictly-normalized group (corrupt fields preserved for validation).
 */
export function normalizeElectrodeGroup(group: unknown = {}, _fallbackId = 0): ElectrodeGroup {
  const source: Record<string, unknown> = isPlainObject(group) ? group : {};
  // Tolerant boundary: the body preserves corrupt field values (e.g. a non-integer id) for
  // validation to flag, so the runtime shape is schema-SHAPED but not strictly `ElectrodeGroup`.
  return {
    id: parseExactInteger(source.id),
    ...buildElectrodeGroupBody(source, { synthesizeText: false }),
  } as unknown as ElectrodeGroup;
}

/**
 * CREATION-path normalization of an electrode group.
 *
 * Identical schema shape to {@link normalizeElectrodeGroup}, but for code that is
 * CREATING a new group (editor / copy / generated maps) it may legitimately need a
 * default id and default text. Synthesis lives HERE, never in the export/load
 * normalizer.
 *
 * @param group - Raw electrode group being created.
 * @param [fallbackId] - Default integer id when the group has none.
 * @returns Normalized group with creation defaults applied.
 */
export function normalizeElectrodeGroupWithDefaults(
  group: unknown = {},
  fallbackId = 0
): ElectrodeGroup {
  const source: Record<string, unknown> = isPlainObject(group) ? group : {};
  const exactId = parseExactInteger(source.id);
  const id = Number.isInteger(exactId) ? exactId : fallbackId;
  return {
    id,
    ...buildElectrodeGroupBody({ ...source, id }, { synthesizeText: true }),
  } as unknown as ElectrodeGroup;
}

/**
 * STRICT export/load normalization of an ntrode channel-map row.
 *
 * Coerces clean integer-string ids to integers; PRESERVES corrupt ids and corrupt
 * map keys/values unchanged so schema/rules flag them. `fallback*` parameters are
 * accepted for call-site compatibility but IGNORED (no index back-fill).
 *
 * @param ntrode - Raw ntrode row.
 * @param [_fallbackNtrodeId] - Ignored.
 * @param [_fallbackGroupId] - Ignored.
 * @returns Strictly-normalized ntrode (corrupt fields preserved).
 */
export function normalizeNtrodeMap(
  ntrode: unknown = {},
  _fallbackNtrodeId = 0,
  _fallbackGroupId = 0
): NtrodeMap {
  const source: Record<string, unknown> = isPlainObject(ntrode) ? ntrode : {};

  // Tolerant boundary: corrupt ids / map entries are preserved for validation (see header).
  return {
    ntrode_id: parseExactInteger(source.ntrode_id),
    electrode_group_id: parseExactInteger(source.electrode_group_id),
    bad_channels: normalizeNumberList(source.bad_channels),
    map: normalizeMap(source.map),
  } as unknown as NtrodeMap;
}

/**
 * CREATION-path normalization of an ntrode channel-map row.
 *
 * Applies default integer ids when absent. Used by editor/copy code that is
 * creating new ntrode rows.
 *
 * @param ntrode - Raw ntrode row being created.
 * @param [fallbackNtrodeId] - Default ntrode_id when absent.
 * @param [fallbackGroupId] - Default electrode_group_id when absent.
 * @returns Normalized ntrode with creation defaults applied.
 */
export function normalizeNtrodeMapWithDefaults(
  ntrode: unknown = {},
  fallbackNtrodeId = 0,
  fallbackGroupId = 0
): NtrodeMap {
  const source: Record<string, unknown> = isPlainObject(ntrode) ? ntrode : {};
  const exactNtrodeId = parseExactInteger(source.ntrode_id);
  const exactGroupId = parseExactInteger(source.electrode_group_id);

  return {
    ntrode_id: Number.isInteger(exactNtrodeId) ? exactNtrodeId : fallbackNtrodeId,
    electrode_group_id: Number.isInteger(exactGroupId) ? exactGroupId : fallbackGroupId,
    bad_channels: normalizeNumberList(source.bad_channels),
    map: normalizeMap(source.map),
  } as unknown as NtrodeMap;
}

function normalizeDeviceName(device: unknown): { name: string[] } {
  const rawName = (device as { name?: unknown } | null | undefined)?.name;
  const names = Array.isArray(rawName)
    ? rawName.map(cleanString).filter(Boolean)
    : [];

  // Tolerant boundary: a corrupt non-string name element is preserved for the schema to flag.
  return { name: (names.length > 0 ? names : [DEFAULT_DEVICE_NAME]) as string[] };
}

export function normalizeDevices(devices: unknown = {}): DeviceConfiguration {
  const source: Record<string, unknown> = isPlainObject(devices) ? devices : {};

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

export function normalizeProbeConfigDevices(devices: unknown = {}): ProbeConfiguration {
  const source: Record<string, unknown> = isPlainObject(devices) ? devices : {};

  return {
    electrode_groups: Array.isArray(source.electrode_groups)
      ? source.electrode_groups.map((group) => normalizeElectrodeGroup(group))
      : [],
    ntrode_electrode_group_channel_map: Array.isArray(source.ntrode_electrode_group_channel_map)
      ? source.ntrode_electrode_group_channel_map.map((ntrode) => normalizeNtrodeMap(ntrode))
      : [],
  };
}

export function normalizeDeviceOverrides(overrides: unknown): DeviceOverrides {
  // Tolerant boundary: a corrupt non-object override passes through verbatim for validation.
  if (!isPlainObject(overrides)) return overrides as DeviceOverrides;
  const normalized: Record<string, unknown> = { ...structuredClone(overrides) };

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
      Object.entries(overrides.bad_channels).map(([ntrodeId, channels]): [string, unknown] => [
        normalizeIdKey(ntrodeId),
        normalizeNumberList(channels),
      ])
    );
  }

  return normalized as unknown as DeviceOverrides;
}

/**
 * Select the configuration snapshot a day resolves against, EXACTLY mirroring
 * `resolveDayConfig`'s selection so the migration and the merge agree:
 *  - a day that pins a `configurationVersion` resolves THAT snapshot by `version`;
 *  - an unpinned day (no `configurationVersion`) resolves the LATEST snapshot.
 * Returns `null` when there is no usable snapshot (no history, or a pin with no
 * matching version) — the migration then leaves the day to the existing repair path.
 *
 * @param animal - The animal record.
 * @param day - The day record.
 * @returns The matching snapshot, or `null` when none resolves.
 */
function selectSnapshotForDay(animal: unknown, day: unknown): Record<string, unknown> | null {
  const rawHistory = (animal as { configurationHistory?: unknown } | null | undefined)
    ?.configurationHistory;
  const history = Array.isArray(rawHistory) ? rawHistory : [];
  if (history.length === 0) return null;

  const dayVersion = (day as { configurationVersion?: unknown } | null | undefined)
    ?.configurationVersion;
  const hasPin = dayVersion != null;
  const snapshot = hasPin
    ? history.find((c) => c && c.version === dayVersion)
    : history[history.length - 1];

  return isPlainObject(snapshot) ? snapshot : null;
}

/**
 * Stable key for a snapshot in the block-set: a day's resolved `(animalId, version)`.
 * Mirrors how a day selects its snapshot, so every day landing on the SAME snapshot
 * version shares the same key.
 *
 * @param animalId - The day's animal id.
 * @param version - The resolved snapshot's `version`.
 * @returns Composite block-set key.
 */
function snapshotKey(animalId: unknown, version: unknown): string {
  return `${animalId as string} ${version as string}`;
}

/**
 * One-time, idempotent, load-time MIGRATION: move config-snapshot ("base")
 * bad-channel marks DOWN into each day's `deviceOverrides.bad_channels`, making
 * bad channels DAY-OWNED. `resolveDayConfig` is now a DAY-OVERRIDE-ONLY merge: it
 * reads each ntrode's effective `bad_channels` from `day.deviceOverrides.bad_channels`
 * and NEVER consults the snapshot base as a fallback (a non-array/absent/corrupt
 * override resolves to `[]`). This migration backfills that day override from the
 * old per-snapshot base so the day-only merge yields the SAME effective set for all
 * well-formed data → byte-identical export.
 *
 * Per-ntrode, for each ntrode in the day's resolved snapshot:
 *  - If the day override ALREADY has that `ntrode_id` key, leave it untouched (it
 *    already owns the marks — and a corrupt non-array value is preserved verbatim,
 *    never laundered). Otherwise, if the snapshot base `bad_channels` for that
 *    ntrode is a non-empty array, copy it into `day.deviceOverrides.bad_channels[ntrodeId]`.
 *  - Then strip `bad_channels` off a snapshot's ntrode rows (set to `[]`). A
 *    snapshot's base is shared by every day pinned to its version, so it is only
 *    stripped once EVERY dependent day's base has been losslessly materialized.
 *
 * A day BLOCKS its snapshot's strip when its override CANNOT be losslessly
 * materialized — either (1) `deviceOverrides.bad_channels` is a CORRUPT non-record
 * container, or (2) the container is a record but a non-empty-base ntrode carries a
 * present NON-array (corrupt) override value. For a blocked snapshot the migration
 * does NOT strip the base — NOT because the merge re-reads it (the day-only merge
 * never does), but to avoid LAUNDERING the corruption: the day's corrupt override is
 * left in place so the export gate (`dayOverrideIssues` / `classifyDeviceOverrides`)
 * still surfaces it and BLOCKS export. The retained base is forensic/repair state,
 * NOT an export fallback — the corrupt-override day resolves to `[]` for that ntrode
 * and stays export-gated until repaired.
 *
 * Net effect: an ntrode that had a day override keeps it; an ntrode that previously
 * relied on base now reads the moved-down override (base is `[]`) → SAME effective
 * set → byte-identical export for well-formed data.
 *
 * It is a NO-OP when no snapshot carries non-empty base `bad_channels` (the
 * overwhelming majority of fixtures), which is also the idempotency guarantee:
 * after one run the unblocked snapshots are base-free, so a second run has nothing
 * to move.
 *
 * Shape-safe: a missing/corrupt animal or snapshot, or a non-array snapshot ntrode
 * map, is skipped (left to the existing repair path), never crashed on. Operates on
 * an already-cloned `normalized` workspace — the caller owns the clone.
 *
 * @param normalized - An ALREADY-CLONED workspace (mutated in place).
 * @returns The same workspace, with base marks moved down.
 */
function applyBadChannelMigration(normalized: unknown): unknown {
  if (!isPlainObject(normalized)) return normalized;
  const animals = (normalized.animals || {}) as Record<string, unknown>;
  const days = (normalized.days || {}) as Record<string, unknown>;

  // The merge is DAY-OVERRIDE-ONLY: `resolveDayConfig` reads each ntrode's
  // bad_channels from `day.deviceOverrides.bad_channels` and NEVER falls back to the
  // snapshot base. So once a day's base is losslessly materialized into a (record)
  // override, the base is dead weight and the snapshot's base is safe to strip.
  // A snapshot's base is shared by EVERY day pinned to its version, so it is stripped
  // only once EVERY dependent day's base has been materialized. TWO distinct shapes
  // BLOCK a snapshot's strip — in both, the day override CANNOT be losslessly
  // materialized, so the migration keeps the base as forensic/repair state (NOT as an
  // export fallback — the merge never reads it) to avoid laundering the corruption:
  //   1. CORRUPT CONTAINER — `deviceOverrides.bad_channels` is a non-record
  //      (e.g. scalar "2.9"): there is no writable record to materialize the base into.
  //      The merge resolves this day to [] for every ntrode and export-gates it.
  //   2. CORRUPT NON-ARRAY VALUE on a BASED ntrode — the container is a record but
  //      a non-empty-base ntrode's override value is present and NOT an array
  //      (e.g. { 1: "2.9" } over base [2]): overwriting that corrupt value with the
  //      base would launder the corruption the export gate needs to surface, so we
  //      leave it (the merge resolves that ntrode to [] and export-gates the day).
  // Two passes:
  //   Pass 1 — materialize base→day-override for materializable days, and record
  //            the resolved (animalId, version) of any day that can't.
  //   Pass 2 — strip a snapshot's base ONLY if no dependent day blocked it.
  const blockedSnapshots = new Set<string>();

  // Pass 1: materialize + detect blockers (per day).
  Object.values(days).forEach((day) => {
    if (!isPlainObject(day)) return;
    const animal = animals[day.animalId as string];
    if (!isPlainObject(animal)) return; // missing/corrupt animal → repair path

    const snapshot = selectSnapshotForDay(animal, day);
    if (!snapshot) return; // no usable snapshot (no history / dangling pin)

    const baseNtrodes = (snapshot.devices as { ntrode_electrode_group_channel_map?: unknown } | null | undefined)
      ?.ntrode_electrode_group_channel_map;
    if (!Array.isArray(baseNtrodes)) return; // corrupt snapshot map → repair path

    // Collect the base marks to move down, keyed by canonical ntrode_id string.
    const toMove: Array<[string, unknown]> = [];
    baseNtrodes.forEach((ntrode) => {
      if (!isPlainObject(ntrode)) return;
      const base = ntrode.bad_channels;
      if (Array.isArray(base) && base.length > 0) {
        toMove.push([normalizeIdKey(ntrode.ntrode_id), base]);
      }
    });

    if (toMove.length === 0) return; // no base to move — NO-OP (idempotency)

    // A corrupt non-record override container CANNOT be safely materialized — there
    // is no writable record to move the base into. Record this day's resolved
    // snapshot as blocked so Pass 2 leaves its base intact (forensic/repair state,
    // NOT an export fallback — the day-only merge resolves this day to [] and
    // export-gates it), and do NOT write into the corrupt container.
    const existing = (day.deviceOverrides as { bad_channels?: unknown } | null | undefined)
      ?.bad_channels;
    if (existing != null && !isPlainObject(existing)) {
      blockedSnapshots.add(snapshotKey(day.animalId, snapshot.version));
      return;
    }

    // The container is a record (or absent). A CORRUPT NON-ARRAY value on a BASED
    // ntrode (present, non-array, over a non-empty base) blocks the strip: we must
    // NOT overwrite that corrupt value with the base — doing so would launder the
    // very corruption the export gate needs to surface (the day-only merge already
    // resolves this ntrode to [] and export-gates the day). So block this snapshot's
    // strip (base kept as forensic/repair state, never read by the merge), while
    // still materializing the OTHER (clean / absent-key) based ntrodes below.
    const hasCorruptValueOnBasedNtrode = toMove.some(([ntrodeId]) => {
      if (!isPlainObject(existing)) return false; // absent container → nothing corrupt
      // Object.hasOwn is ES2022; the pre-ES2022 .call form is byte-equivalent for plain records.
      if (!Object.prototype.hasOwnProperty.call(existing, ntrodeId)) return false; // absent key → materializable
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
    // Stable record reference (avoids re-narrowing the Record index access through reassignment).
    const overridesBag = day.deviceOverrides as Record<string, unknown>;
    if (!isPlainObject(overridesBag.bad_channels)) {
      overridesBag.bad_channels = {};
    }
    const target = overridesBag.bad_channels as Record<string, unknown>;
    toMove.forEach(([ntrodeId, base]) => {
      // REPLACE precedence: an existing override (incl. a corrupt non-array value) wins —
      // never overwrite it, never launder it. Only an ABSENT key is materialized.
      if (!Object.prototype.hasOwnProperty.call(target, ntrodeId)) {
        target[ntrodeId] = [...(base as unknown[])];
      }
    });
  });

  // Pass 2: strip each snapshot's base ONLY if no dependent day blocked it. The
  // day-only merge never reads the base, so an unblocked snapshot's stripped base is
  // dead weight; a blocked snapshot keeps its base as forensic/repair state for the
  // export gate, not as a merge fallback.
  Object.entries(animals).forEach(([animalId, animal]) => {
    if (!isPlainObject(animal)) return;
    const history = Array.isArray(animal.configurationHistory)
      ? animal.configurationHistory
      : [];
    history.forEach((snapshot) => {
      if (!isPlainObject(snapshot)) return;
      if (blockedSnapshots.has(snapshotKey(animalId, snapshot.version))) return;

      const baseNtrodes = (snapshot.devices as { ntrode_electrode_group_channel_map?: unknown } | null | undefined)
        ?.ntrode_electrode_group_channel_map;
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
 * @param workspace - Workspace to migrate (not mutated).
 * @returns A migrated deep clone (or the input unchanged when not an object).
 */
export function migrateBadChannelsToDays(workspace: unknown): unknown {
  if (!isPlainObject(workspace)) return workspace;
  return applyBadChannelMigration(structuredClone(workspace));
}

export function normalizeWorkspaceDevices(
  workspace: unknown,
  { migrateBadChannels = true }: { migrateBadChannels?: boolean } = {}
): Record<string, unknown> {
  if (!isPlainObject(workspace)) return workspace as Record<string, unknown>;

  const normalized: Record<string, unknown> = structuredClone(workspace);
  const animals = (normalized.animals || {}) as Record<string, unknown>;

  Object.values(animals).forEach((animal) => {
    if (!isPlainObject(animal)) return;

    // Capture a corrupt (present-but-non-array) data_acq_device BEFORE normalizing: the
    // raw-state contract requires persisted corruption to survive hydration so raw-shape
    // validation can surface its repair banner. normalizeDevices would otherwise launder it
    // to [] here (at load), silently hiding the corruption — exactly what the contract
    // forbids. A corrupt configurationHistory is already preserved below (the Array.isArray
    // guard leaves a non-array untouched), and animal.cameras is top-level (never normalized
    // here), so data_acq_device is the only laundering gap to close.
    const rawDevices: Record<string, unknown> = isPlainObject(animal.devices)
      ? animal.devices
      : {};
    const rawDataAcq = rawDevices.data_acq_device;

    animal.devices = normalizeDevices(animal.devices || EMPTY_DEVICES);

    if (rawDataAcq != null && !Array.isArray(rawDataAcq)) {
      // Re-assert the preserved corrupt non-array (raw-state contract); the write target is a record.
      (animal.devices as Record<string, unknown>).data_acq_device = rawDataAcq;
    }

    if (Array.isArray(animal.configurationHistory)) {
      animal.configurationHistory = animal.configurationHistory.map((snapshot) => ({
        ...snapshot,
        devices: normalizeProbeConfigDevices(snapshot.devices || {}),
      }));
    }
  });

  Object.values((normalized.days || {}) as Record<string, unknown>).forEach((day) => {
    if (!isPlainObject(day)) return;

    if (day.deviceOverrides) {
      day.deviceOverrides = normalizeDeviceOverrides(day.deviceOverrides);
    }
  });

  // After per-snapshot / per-day normalization, move any config-snapshot base
  // bad-channel marks DOWN into the owning day's overrides (a no-op for the
  // base-free majority). Runs last so the moved values come from already-
  // normalized snapshots and land in already-normalized override records.
  //
  // This is a ONE-TIME, LOAD-time migration of legacy persisted shape; callers that only need
  // device-shape normalization (the per-save path) pass `migrateBadChannels: false` so the
  // migration's idempotency stops being a load-bearing invariant of every write. Skipping it on
  // save is byte-identical for any in-memory workspace that was already loaded/hydrated (where the
  // migration already ran and is a no-op), and the next load migrates anything that wasn't.
  return (migrateBadChannels ? applyBadChannelMigration(normalized) : normalized) as Record<
    string,
    unknown
  >;
}
