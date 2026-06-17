/**
 * @fileoverview Day-validation issue producers that supplement schema + rules.
 *
 * The family of validators that surface problems the export merge would otherwise hide
 * (fail-open) or mis-route: malformed/stale/shadowing `day.deviceOverrides`
 * ({@link dayOverrideIssues}), an unpinned configuration ({@link unpinnedConfigurationIssues}),
 * a dangling recording-system reference ({@link danglingDataAcqRefIssue}), a divergent
 * recording-system catalog ({@link divergentDataAcqCatalogIssue}), and silently un-failed bad
 * channels ({@link badChannelUnfailIssues}). The composer ({@link module:domain/dayValidationComposer})
 * folds these into the authoritative issue list. Extracted from `domain/validation.js` (Phase 9a)
 * with no behavior change.
 */

import { getConfigHistory, getDataAcqDevices } from '../state/workspaceSelectors';
import { badChannelRegressions } from './badChannelMonotonicity';
import { geometryDomainOf } from './geometryProvenance';
import type { RepairableIssue } from './repairRouting';
import {
  isPlainRecord,
  classifyGeometryOverride,
  classifyBadChannelsContainer,
} from './deviceOverrideMerge';

/**
 * The day fields the override / data-acq issue producers READ. Every field is `unknown`: these
 * producers exist to surface CORRUPT day shapes, so the day is a tolerant-read boundary (a
 * selector would hide exactly what they validate). The real `Day` is structurally assignable.
 */
interface ProducerDayInput {
  /** Day-owned device overrides (any shape — corruption is surfaced, not trusted). */
  deviceOverrides?: unknown;
  /** Pinned configuration version (absent on legacy/recovered days). */
  configurationVersion?: unknown;
  /** Day-owned reference into the animal's recording-system catalog. */
  data_acq_device_name?: unknown;
}

/** The merged-model fields {@link dayOverrideIssues} reads (the resolved ntrode id set). */
interface MergedDayOverrideInput {
  /** The resolved ntrode rows (always an array post-merge). */
  ntrode_electrode_group_channel_map?: Array<{ ntrode_id?: unknown }>;
}

/**
 * Surface EVERY malformed/stale/shadowing `day.deviceOverrides` shape that
 * `resolveDayConfig` cannot faithfully apply (or applies in a way whose errors
 * mis-route), so it becomes a visible, day-routed, export-blocking, REPAIRABLE issue
 * instead of vanishing (fail-open), being smeared onto the geometry path (mis-routed
 * to the Animal Editor), or dead-ending repair. This is the validation "shadow" of
 * `resolveDayConfig`; the two MUST stay in lockstep — whenever the merge can't honor an
 * override cleanly, this surfaces a day-routed escape, and the Failed channels tab renders a
 * removal control for it.
 *
 * Covered shapes (all → `day` surface, `devices` step, error severity):
 *  - the WHOLE `deviceOverrides` is not a record (e.g. scalar "corrupt"): the merge
 *    reads `overrides?.x` off it (all undefined → fail-open to the snapshot), so it
 *    would export as if clean (`malformed_device_override`, path `deviceOverrides`);
 *  - a geometry override (`electrode_groups` / `ntrode_electrode_group_channel_map`)
 *    present but not an array — the merge falls back to the snapshot, hiding the
 *    corruption (`malformed_device_override`, path `deviceOverrides.<key>`);
 *  - a VALID-SHAPED (array) geometry override whose CONTENTS produce validation errors:
 *    the merge honors it (a supported feature — it shadows the snapshot), but those
 *    errors route to the Animal Editor, which edits the SNAPSHOT, not this day's
 *    override — a dead-end. We add a day-routed removable escape so the user can drop
 *    the override (`shadowed_geometry_override`, requires `baseIssues`);
 *  - a `bad_channels` container that is not an ntrode_id→list map (e.g. scalar "2.9")
 *    — the merge ignores it entirely (`malformed_bad_channel_override`);
 *  - a `bad_channels` key with no resolved ntrode — stale/dangling, keyed by ntrode_id
 *    for precise repair focus (`stale_bad_channel_override`);
 *  - a `bad_channels` value under a VALID key that is not a list — the merge declines
 *    to apply it (rather than smear a scalar onto the ntrode row), keyed by ntrode_id
 *    (`malformed_bad_channel_override`).
 *
 * Per-key `bad_channels` issues carry a KEY-SPECIFIC path (`deviceOverrides.bad_channels.<id>`)
 * so the stepper's repair-focus lands on the clicked ntrode's removal control, not the
 * first matching one.
 *
 * These issues are folded into `computeStepStatus` (the export gate) AND the rendered
 * repair lists via {@link validateDay}, so a blocking override is always repairable on
 * the Devices step, never "gated but invisible" or routed to a dead-end.
 *
 * @param day - The day record (reads `deviceOverrides`).
 * @param mergedDay - Merged metadata (resolved ntrode id set).
 * @param baseIssues - The `validate(mergedDay)` issues, used to detect whether
 *   an active array geometry override's contents are actually erroring (so a CLEAN valid
 *   override is not flagged). Defaults to empty (skips the shadowed-override check).
 * @returns Error issues for malformed/stale/shadowing overrides.
 */
export function dayOverrideIssues(
  day: ProducerDayInput | null | undefined,
  mergedDay: MergedDayOverrideInput | null | undefined,
  baseIssues: RepairableIssue[] = []
): RepairableIssue[] {
  const overrides = day?.deviceOverrides;
  if (overrides == null) return [];

  // The WHOLE container is a scalar/array, not a record. resolveDayConfig reads
  // `overrides?.electrode_groups` etc. off it (all undefined → fail-open to the
  // snapshot), so a restored `deviceOverrides: "corrupt"` exports as if nothing were
  // wrong. Surface + make removable; nothing further can be inspected.
  if (!isPlainRecord(overrides)) {
    return [{
      path: 'deviceOverrides',
      field: 'deviceOverrides',
      step: 'devices',
      repairSurface: 'day',
      actionLabel: 'Remove device overrides',
      repairCommand: { type: 'resetDeviceOverrides' },
      code: 'malformed_device_override',
      severity: 'error',
      message:
        `This day's device overrides are corrupt (expected an object). They are being ignored ` +
        `in favor of the saved configuration — remove them to clear this error.`,
    }];
  }

  const issues: RepairableIssue[] = [];

  // Geometry overrides. The app never PRODUCES day-level geometry overrides (probe
  // geometry lives in animal configuration snapshots), but `resolveDayConfig` honors a
  // valid array override (a supported legacy/import feature). So:
  //  - present-but-not-an-array → corrupt, fail-open hidden → blocking + removable;
  //  - present array whose CONTENTS error → honored-but-shadowing the snapshot, errors
  //    mis-route to the Animal Editor → add a day-routed removable escape. A CLEAN valid
  //    array override is NOT flagged (no dead-end to break).
  const baseErrors = (Array.isArray(baseIssues) ? baseIssues : []).filter((i) => i?.severity === 'error');
  // A geometry override is "erroring" only when its STRUCTURAL contents err — a day-owned
  // bad-channel overlay error on an ntrode path must NOT blame a clean override.
  // {@link geometryDomainOf} encodes that classification (shared with the provenance re-tag).
  const GEOMETRY_DOMAINS: Record<string, (i: RepairableIssue) => boolean> = {
    electrode_groups: (i) => geometryDomainOf(i) === 'electrode_groups',
    ntrode_electrode_group_channel_map: (i) => geometryDomainOf(i) === 'ntrode',
  };
  for (const key of ['electrode_groups', 'ntrode_electrode_group_channel_map']) {
    // Same shape classification the merge resolves with ({@link classifyGeometryOverride}):
    // 'absent' → merge uses the snapshot (no issue); 'malformed' → merge fails open, hiding
    // the corruption (surface it); 'array' → merge honors it / it shadows the snapshot.
    const kind = classifyGeometryOverride(overrides[key]);
    if (kind === 'absent') continue;
    if (kind === 'malformed') {
      issues.push({
        path: `deviceOverrides.${key}`,
        field: key,
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Remove device override',
        repairCommand: { type: 'removeDeviceOverrideKey', key },
        code: 'malformed_device_override',
        severity: 'error',
        message:
          `This day's "${key}" device override is corrupt (expected a list of devices). ` +
          `It is being ignored in favor of the saved configuration — remove the override to clear this error.`,
      });
    } else if (baseErrors.some(GEOMETRY_DOMAINS[key])) {
      issues.push({
        path: `deviceOverrides.${key}`,
        field: key,
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Remove device override',
        code: 'shadowed_geometry_override',
        severity: 'error',
        message:
          `This day overrides the saved device ${key === 'electrode_groups' ? 'electrode groups' : 'channel map'} ` +
          `and the override has validation errors. Those errors can't be fixed in Animal Setup (which edits ` +
          `the saved configuration, not this day's override). Remove the day override to use the saved configuration.`,
      });
    }
  }

  // Whole-map ntrode override rows are GEOMETRY ONLY. The merge (`resolveEffectiveDevices`,
  // invoked by `resolveDayConfig`) resolves each ntrode's effective bad channels from
  // `deviceOverrides.bad_channels` (keyed by ntrode_id) EXCLUSIVELY — it never reads a
  // `bad_channels` array baked into an override ROW. So a
  // restored/hand-edited override row carrying a non-empty `bad_channels` with no matching
  // `deviceOverrides.bad_channels[ntrode_id]` entry would have those marks SILENTLY zeroed at
  // export. No in-app path writes such a row (import routes geometry to the snapshot and bad
  // channels to `deviceOverrides.bad_channels`), but older/hand-edited persisted JSON can hit
  // it — surface it as an export blocker rather than drop the marks. The fix is to move those
  // marks into the day's bad-channel overrides (`deviceOverrides.bad_channels`).
  const ntrodeOverride = overrides.ntrode_electrode_group_channel_map;
  const badChannelsMap: Record<string, unknown> = isPlainRecord(overrides.bad_channels)
    ? overrides.bad_channels
    : {};
  if (Array.isArray(ntrodeOverride)) {
    ntrodeOverride.forEach((row) => {
      const rowBad = row?.bad_channels;
      if (!Array.isArray(rowBad) || rowBad.length === 0) return;
      const id = String(row?.ntrode_id);
      const coveredEntry = badChannelsMap[id];
      const covered = Array.isArray(coveredEntry) && coveredEntry.length > 0;
      if (covered) return;
      issues.push({
        path: `deviceOverrides.bad_channels.${id}`,
        field: 'bad_channels',
        step: 'devices',
        repairSurface: 'day',
        actionLabel: 'Move failed channels to day overrides',
        code: 'bad_channels_on_override_row_ignored',
        severity: 'error',
        message:
          `This day's channel-map override carries failed channels on ntrode "${id}", but failed ` +
          `channels on an override row are IGNORED at export (they are resolved only from the day's ` +
          `failed-channel overrides). Move them into this day's failed-channel overrides so they are ` +
          `not silently lost.`,
      });
    });
  }

  // Same container classification the merge resolves with ({@link classifyBadChannelsContainer}):
  // 'absent' → nothing to apply; 'malformed' → merge ignores it entirely (surface it);
  // 'record' → resolved per ntrode_id (inspect each key for stale/corrupt-value).
  const bad = overrides.bad_channels;
  const badKind = classifyBadChannelsContainer(bad);
  if (badKind === 'malformed') {
    // Container is a scalar/array instead of an ntrode_id→list map: the merge
    // ignores it entirely, so without this it would vanish with no repair.
    issues.push({
      path: 'deviceOverrides.bad_channels',
      field: 'bad_channels',
      step: 'devices',
      repairSurface: 'day',
      actionLabel: 'Remove failed-channel override',
      repairCommand: { type: 'resetBadChannelOverrides' },
      code: 'malformed_bad_channel_override',
      severity: 'error',
      message:
        `This day's failed-channel override is corrupt (expected a map of ntrode id → ` +
        `failed-channel list). It is being ignored — remove the override to clear this error.`,
    });
  } else if (badKind === 'record') {
    // `badKind === 'record'` ⟺ `isPlainRecord(bad)` (classifyBadChannelsContainer's contract),
    // so `bad` is a record here — narrow for the per-key inspection below.
    const badRecord = bad as Record<string, unknown>;
    const validNtrodeIds = new Set(
      (mergedDay?.ntrode_electrode_group_channel_map || []).map((n) => String(n?.ntrode_id))
    );
    Object.keys(badRecord).forEach((key) => {
      if (!validNtrodeIds.has(String(key))) {
        issues.push({
          path: `deviceOverrides.bad_channels.${key}`,
          field: 'bad_channels',
          step: 'devices',
          repairSurface: 'day',
          actionLabel: 'Remove stale failed-channel override',
          repairCommand: { type: 'removeBadChannelOverrideKey', key: String(key) },
          code: 'stale_bad_channel_override',
          severity: 'error',
          message:
            `A day-level bad-channel override targets ntrode "${key}", which no longer exists ` +
            `in this day's channel map. Remove the stale override or restore the ntrode.`,
        });
      } else if (!Array.isArray(badRecord[key])) {
        // Value under a VALID ntrode key is not a list. resolveDayConfig declines to
        // apply it (smearing a scalar onto the ntrode row would surface as an
        // Animal-Editor schema error on a field the user can't reach there), so the
        // corrupt value is surfaced HERE, keyed to its real owner (the day override).
        issues.push({
          path: `deviceOverrides.bad_channels.${key}`,
          field: 'bad_channels',
          step: 'devices',
          repairSurface: 'day',
          actionLabel: 'Remove failed-channel override',
          repairCommand: { type: 'removeBadChannelOverrideKey', key: String(key) },
          code: 'malformed_bad_channel_override',
          severity: 'error',
          message:
            `A day-level failed-channel override for ntrode "${key}" is corrupt (expected a ` +
            `list of channel numbers). Remove the stale override to clear this error.`,
        });
      }
    });
  }

  return issues;
}

/**
 * Export-blocking issue for a day with NO pinned `configurationVersion` in a multi-version
 * animal. `resolveDayConfig` silently resolves such a day to the LATEST snapshot, which can
 * export the wrong probe geometry for a recovered/imported day that actually recorded an
 * earlier configuration. `createDay` always pins, so this only arises from legacy/recovered
 * data — and now that the Day Devices step offers an in-place version-pin control, it is safe
 * to fail closed rather than merely warn. Routes to the Devices step (where the pin control
 * lives) so the disabled-export state links to a real repair.
 *
 * @param day - The day record.
 * @param animal - The owning animal (for the configuration history).
 * @returns A single error issue, or `[]` when pinned / single-version / no animal.
 */
export function unpinnedConfigurationIssues(
  day: ProducerDayInput | null | undefined,
  animal: unknown
): RepairableIssue[] {
  if (!animal || day?.configurationVersion != null) return [];
  const history = getConfigHistory(animal);
  if (history.length <= 1) return [];
  const latestEntry = history[history.length - 1];
  // The latest snapshot's version, for the message. Guard a malformed history entry so the copy
  // reads "the latest configuration" rather than "v undefined" when the version is missing.
  const latestLabel =
    latestEntry?.version != null ? `the latest (v${latestEntry.version})` : 'the latest configuration';
  return [
    {
      code: 'unpinned_configuration',
      severity: 'error',
      step: 'devices',
      repairSurface: 'day',
      field: 'configurationVersion',
      focusPath: 'configurationVersion',
      message:
        `This recording day has no pinned hardware configuration version, but this animal has ` +
        `${history.length} configurations. It would export against ${latestLabel}. ` +
        `Pin the configuration version this day actually recorded before exporting.`,
    },
  ];
}

/**
 * Export-blocking issue for a day whose `data_acq_device_name` references a recording system that is
 * no longer in the animal's catalog (renamed, removed, or a stale import). {@link resolveDayDataAcqDevice}
 * would SILENTLY fall back to the first catalog entry — exporting a DIFFERENT acquisition device than
 * the day recorded on (a wrong Spyglass `DataAcquisitionDevice` identity, which is irreversible once in
 * the NWB/Spyglass record). The reference is consumed during the merge, so the merged-model rules can't
 * see it; this catches it at the RAW boundary, mirroring `dangling_camera_ref` / `dangling_electrode_group_ref`.
 *
 * An UNSET reference is the documented "use the animal default (first)" path and is NOT flagged.
 *
 * @param day - The day record (`data_acq_device_name`).
 * @param animal - The owning animal (its `data_acq_device` catalog).
 * @returns Zero or one issue (day-routed, Devices step, error).
 */
export function danglingDataAcqRefIssue(
  day: ProducerDayInput | null | undefined,
  animal: unknown
): RepairableIssue[] {
  const name = day?.data_acq_device_name;
  if (typeof name !== 'string' || name.trim() === '') return []; // unset → animal default: fine
  // `as object` bridges the selector's imprecise `@param {object}` JSDoc; it is null-safe at
  // runtime (`getAnimalDevices(animal)` reads `animal?.devices`), so the cast is behavior-neutral.
  if (getDataAcqDevices(animal as object).some((d) => d?.name === name)) return []; // resolves: fine
  return [
    {
      path: 'data_acq_device',
      field: 'data_acq_device',
      step: 'devices',
      actionLabel: 'Fix recording system',
      code: 'dangling_data_acq_ref',
      repairSurface: 'day',
      severity: 'error',
      message:
        `This recording day was set to use recording system "${name}", but no recording system with ` +
        `that name exists for this animal anymore (it was renamed or removed). Without a fix the export ` +
        `would silently use a different system. Pick an existing recording system for this day in its ` +
        `setup, or restore "${name}" on the animal's Recording System tab.`,
    },
  ];
}

/**
 * Export-blocking issue for an animal whose recording-system CATALOG defines the same device
 * `name` twice with different `system`/`amplifier`/`adc_circuit`. In Spyglass the device name is an
 * identity (one `DataAcquisitionDevice` per name), so a divergent duplicate silently reuses the
 * wrong row. The merged export model carries only ONE device (`resolveDayDataAcqDevice` collapses
 * the catalog to the day's referenced entry), so the merged-model `divergent_data_acq_identity`
 * rule can never see this — it must be checked at the RAW catalog boundary, mirroring
 * {@link danglingDataAcqRefIssue}. The edit-time identity guard prevents creating such a catalog,
 * so this catches hand-edited / imported / legacy persisted state.
 *
 * @param animal - The owning animal (its `devices.data_acq_device` catalog).
 * @returns One issue per divergent name (animal-routed, Devices step, error).
 */
export function divergentDataAcqCatalogIssue(animal: unknown): RepairableIssue[] {
  const catalog = getDataAcqDevices(animal);
  const seen = new Map<string, string>(); // name -> first entry's hardware signature
  const reported = new Set<string>();
  const issues: RepairableIssue[] = [];
  catalog.forEach((device) => {
    const name = device?.name;
    if (typeof name !== 'string' || name === '') return;
    const signature = JSON.stringify(
      (['system', 'amplifier', 'adc_circuit'] as const).map((key) => device?.[key] ?? null)
    );
    if (!seen.has(name)) {
      seen.set(name, signature);
    } else if (seen.get(name) !== signature && !reported.has(name)) {
      reported.add(name);
      issues.push({
        path: 'data_acq_device',
        field: 'name',
        step: 'devices',
        repairSurface: 'animal',
        actionLabel: 'Use a new device name',
        code: 'divergent_data_acq_identity',
        severity: 'error',
        message:
          `Recording system "${name}" is defined more than once in this animal's catalog with ` +
          `different system/amplifier/adc_circuit. In Spyglass the device name is an identity — ` +
          `give each distinct system a unique name, or make the duplicates identical.`,
      });
    }
  });
  return issues;
}

/**
 * Export-blocking issues for a day that silently "un-fails" bad channels — drops a channel that
 * was bad on an EARLIER same-`configurationVersion` recording day without an off-export
 * acknowledgment. Bad channels are MONOTONIC across a study (hardware does not heal): a later
 * day's effective bad set should never be a strict subset of an earlier same-config day's. The
 * effective sets are read day-owned ({@link getDayBadChannelOverrides}), so this catches the
 * regression the export merge would otherwise emit verbatim (a quietly recovered channel that
 * was actually dead — corrupting downstream analysis).
 *
 * The config-version boundary is HONORED ({@link badChannelRegressions} never compares across
 * versions): a probe reconfiguration legitimately resets channels. Each regressing ntrode yields
 * one day-routed, Devices-step, error issue carrying an `acknowledgeBadChannelRemovals` repair
 * command — so the block is clearable by acknowledging the removal (an override), not only by
 * restoring the channel. With no cross-day context (`animalDays` empty) there is nothing to
 * compare, so this is a no-op — preserving every existing single-day call site.
 *
 * @param day - The day being checked.
 * @param animal - The owning animal.
 * @param animalDays - The animal's day records (for the earlier same-config union).
 * @returns Zero or more error issues (one per regressing ntrode).
 */
export function badChannelUnfailIssues(
  day: unknown,
  animal: unknown,
  animalDays: unknown[] = []
): RepairableIssue[] {
  // `as object` bridges badChannelRegressions' imprecise `@param {object}` JSDoc; it guards its
  // inputs internally (cross-day comparison is a no-op for missing/corrupt data), so this is
  // behavior-neutral.
  const regressions = badChannelRegressions(animal as object, day as object, animalDays);
  return Object.keys(regressions).map((ntrodeId) => {
    const channels = regressions[ntrodeId];
    return {
      path: `deviceOverrides.bad_channels.${ntrodeId}`,
      field: 'bad_channels',
      step: 'devices',
      repairSurface: 'day',
      actionLabel: 'Acknowledge un-marking',
      code: 'bad_channel_unfailed_without_ack',
      severity: 'error',
      repairCommand: {
        type: 'acknowledgeBadChannelRemovals',
        acks: { [ntrodeId]: channels },
      },
      message:
        `Channel${channels.length === 1 ? '' : 's'} ${channels.join(', ')} on ntrode ${ntrodeId} ` +
        `${channels.length === 1 ? 'was' : 'were'} marked bad on an earlier recording day with the ` +
        `same probe configuration; bad channels are monotonic. Re-mark ${channels.length === 1 ? 'it' : 'them'}, ` +
        `or acknowledge the removal.`,
    };
  });
}
