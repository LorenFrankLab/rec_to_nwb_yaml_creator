/**
 * @fileoverview Workspace day-validation and repair-routing domain module.
 *
 * The single owner of app-wide day validation composition, step-status computation,
 * issue→step/owner routing, and Animal-Editor deep-link routing. Consumed by the Day
 * Editor steps, the Animal Editor, the Validation summary, the Export step, and the
 * shared RepairActions — none of which may own this behavior themselves. Builds on the
 * core schema/rules validation in `src/validation`; the page-only field-blur helper
 * (`validateField`) stays in `pages/DayEditor/validation.js`.
 */

import { validate } from '../validation';
import { validateRawDay, validateRawAnimal } from '../validation/rawShape';
import { getConfigHistory } from '../state/workspaceSelectors';

/**
 * Whether `value` is a plain object record (not null, not an array). Mirrors the
 * helper in `workspaceUtils.js` — used to tell a well-formed override container/map
 * from a malformed (scalar/array) one.
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Classify a validation issue into its GEOMETRY domain — the single source for both the
 * provenance re-tag and the shadowed-override check, so the subtle path matching can't
 * drift between them:
 *   - `'electrode_groups'` — an electrode-group structural error;
 *   - `'ntrode'` — an ntrode channel-map structural error;
 *   - `null` — a bad-channel overlay error (lives on an ntrode path but is a day-owned
 *     overlay, so it must NOT be attributed to a geometry override) or a non-geometry issue.
 *
 * `'electrode_groups'` (with the trailing 's') appears only in electrode-group paths; the
 * ntrode path is `ntrode_electrode_group_channel_map` (singular `electrode_group`).
 *
 * @param {{path?: string, instancePath?: string, field?: string, code?: string}} issue
 * @returns {'electrode_groups'|'ntrode'|null}
 */
function geometryDomainOf(issue) {
  const path = issue?.path || issue?.instancePath || '';
  const isBadChannel =
    issue?.field === 'bad_channels' ||
    path.includes('bad_channels') ||
    issue?.code === 'bad_channel_out_of_range' ||
    issue?.code === 'multishank_bad_channels_ignored';
  if (isBadChannel) return null;
  if (path.includes('electrode_groups')) return 'electrode_groups';
  if (path.includes('ntrode')) return 'ntrode';
  return null;
}

/**
 * Surface EVERY malformed/stale/shadowing `day.deviceOverrides` shape that
 * `resolveDayConfig` cannot faithfully apply (or applies in a way whose errors
 * mis-route), so it becomes a visible, day-routed, export-blocking, REPAIRABLE issue
 * instead of vanishing (fail-open), being smeared onto the geometry path (mis-routed
 * to the Animal Editor), or dead-ending repair. This is the validation "shadow" of
 * `resolveDayConfig`; the two MUST stay in lockstep — whenever the merge can't honor an
 * override cleanly, this surfaces a day-routed escape, and {@link DevicesStep} renders a
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
 * @param {object} day - The day record (reads `deviceOverrides`).
 * @param {object} mergedDay - Merged metadata (resolved ntrode id set).
 * @param {Array} [baseIssues] - The `validate(mergedDay)` issues, used to detect whether
 *   an active array geometry override's contents are actually erroring (so a CLEAN valid
 *   override is not flagged). Defaults to empty (skips the shadowed-override check).
 * @returns {Array} Error issues for malformed/stale/shadowing overrides.
 */
export function dayOverrideIssues(day, mergedDay, baseIssues = []) {
  const overrides = day?.deviceOverrides;
  if (overrides == null) return [];

  // The WHOLE container is a scalar/array, not a record. resolveDayConfig reads
  // `overrides?.electrode_groups` etc. off it (all undefined → fail-open to the
  // snapshot), so a restored `deviceOverrides: "corrupt"` exports as if nothing were
  // wrong. Surface + make removable; nothing further can be inspected.
  if (!isRecord(overrides)) {
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

  const issues = [];

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
  const GEOMETRY_DOMAINS = {
    electrode_groups: (i) => geometryDomainOf(i) === 'electrode_groups',
    ntrode_electrode_group_channel_map: (i) => geometryDomainOf(i) === 'ntrode',
  };
  for (const key of ['electrode_groups', 'ntrode_electrode_group_channel_map']) {
    const value = overrides[key];
    if (value == null) continue;
    if (!Array.isArray(value)) {
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
          `and the override has validation errors. Those errors can't be fixed in the Animal Editor (which edits ` +
          `the saved configuration, not this day's override). Remove the day override to use the saved configuration.`,
      });
    }
  }

  const bad = overrides.bad_channels;
  if (bad != null) {
    if (!isRecord(bad)) {
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
    } else {
      const validNtrodeIds = new Set(
        (mergedDay?.ntrode_electrode_group_channel_map || []).map((n) => String(n?.ntrode_id))
      );
      Object.keys(bad).forEach((key) => {
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
        } else if (!Array.isArray(bad[key])) {
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
 * @param {object} day - The day record.
 * @param {object} [animal] - The owning animal (for the configuration history).
 * @returns {Array} A single error issue, or `[]` when pinned / single-version / no animal.
 */
function unpinnedConfigurationIssues(day, animal) {
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
 * The authoritative issue list for a day, and the SINGLE source so the export gate
 * (`computeStepStatus`) and the rendered repair lists (ValidationStep, ExportStep) never
 * diverge — a blocking issue must always be visible and repairable, never "gated but
 * invisible". It folds together, in order:
 *   1. raw-shape issues for the persisted day AND animal ({@link validateRawDay} /
 *      {@link validateRawAnimal}) — Boundary 1, caught before the merge can launder them;
 *   2. schema + rules over the merged model, with day-overridden geometry errors re-tagged
 *      to the day surface by provenance ({@link tagBaseOwnershipByProvenance}) — Boundary 2;
 *   3. the family of malformed/stale/shadowing `deviceOverrides` issues the merge would
 *      otherwise hide ({@link dayOverrideIssues});
 *   4. the `unpinned_configuration` export-blocker ({@link unpinnedConfigurationIssues}).
 * Every issue is then run through {@link normalizeIssue} so it carries the canonical
 * ownership contract.
 *
 * @param {object} day - The day record.
 * @param {object} mergedDay - Merged animal + day metadata.
 * @param {object} [animal] - The owning animal (optional); folds raw animal-shape issues
 *   (e.g. a non-array `cameras`) into the gate.
 * @returns {Array} All validation issues for the day (each ownership-normalized).
 */
export function validateDay(day, mergedDay, animal) {
  // Boundary 1: validate the RAW persisted day AND animal shape FIRST — before the merge
  // launders a corrupt collection (`tasks: {}`, `animal.cameras: "nope"`) into an empty
  // export default that the merged-model validation below would see as clean. These block
  // export on raw corruption regardless of how the merge would launder it. `animal` is
  // optional (call sites that have it pass it); without it, animal raw issues are skipped.
  const raw = validateRawDay(day);
  const rawAnimal = validateRawAnimal(animal);
  // Compute the base (schema + rules) issues once, then pass them to dayOverrideIssues
  // so it can tell an erroring array geometry override (a dead-end that needs a day-routed
  // escape) from a clean one (which must NOT be flagged).
  const base = validate(mergedDay);
  // Boundary 2: ownership by PROVENANCE, not path. A geometry error's owner depends on
  // WHERE the merged geometry came from — the animal snapshot (animal-owned, edit there)
  // or a day-level override (day-owned, the snapshot is the wrong editor). Re-tag base
  // geometry errors to the day when the day overrides that geometry, so they don't
  // dead-end on "Fix in Animal Editor".
  const taggedBase = tagBaseOwnershipByProvenance(base, dayGeometryProvenance(day));
  // Stamp every issue with the canonical ownership contract (normalizeIssue) so consumers
  // read `ownerSurface`/`step`/`focusPath` directly — never re-inferring — and an issue
  // with no resolvable owner throws loudly instead of silently routing to the Day Editor.
  return [
    ...raw,
    ...rawAnimal,
    ...taggedBase,
    ...dayOverrideIssues(day, mergedDay, base),
    ...unpinnedConfigurationIssues(day, animal),
  ].map(normalizeIssue);
}

/**
 * Canonicalize a validation issue so the ownership contract is ENFORCED, not conventional.
 * The owner is resolved ONCE here (the same chain {@link repairTargetForIssue} uses) and
 * stamped explicitly: `ownerSurface` (mirrored to the legacy `repairSurface` so a consumer
 * reading either gets the same answer), a guaranteed `focusPath` (the schema `path` when no
 * explicit anchor was set), and — for a day issue — the resolved `step`. The never-read
 * `repairStep` issue field is dropped so the field generations can't drift. An issue that
 * resolves to no valid surface throws (a contract violation must be loud, never a silent
 * default-to-Day).
 *
 * @param {object} issue - A raw validation issue.
 * @returns {object} The issue with canonical ownership/focus fields.
 */
function normalizeIssue(issue) {
  if (!issue || typeof issue !== 'object') return issue;
  const { surface, step } = repairTargetForIssue(issue);
  if (!REPAIR_SURFACES.has(surface)) {
    throw new Error(
      `normalizeIssue: unresolved ownerSurface for code="${issue.code}" path="${issue.path || issue.instancePath || ''}"`
    );
  }
  const next = {
    ...issue,
    ownerSurface: surface,
    repairSurface: surface,
    focusPath: issue.focusPath || issue.path || issue.instancePath,
  };
  // `step` routes only the day surface (animal/none go to their own editors); stamp the
  // resolved day step so grouping/focus read one field, and drop the dead alias.
  if (surface === 'day' && step != null) next.step = step;
  delete next.repairStep;
  return next;
}

/**
 * Day-level geometry provenance, derived from the persisted day's overrides ALONE (no
 * animal needed): a collection is day-owned exactly when the day overrides it with an
 * array. `bad_channels` are always a day-editable overlay (their rule already routes to
 * day), so they are not part of geometry provenance.
 *
 * @param {object} day - The persisted day.
 * @returns {{ electrode_groups: boolean, ntrode: boolean }} Whether each is day-overridden.
 */
function dayGeometryProvenance(day) {
  const ov = day && typeof day === 'object' && !Array.isArray(day) ? day.deviceOverrides : null;
  const rec = ov && typeof ov === 'object' && !Array.isArray(ov) ? ov : {};
  return {
    electrode_groups: Array.isArray(rec.electrode_groups),
    ntrode: Array.isArray(rec.ntrode_electrode_group_channel_map),
  };
}

/**
 * Re-tag base (schema/rule) GEOMETRY errors with explicit day ownership when the day
 * overrides that geometry — the override, not the animal snapshot, owns them, so fixing
 * the snapshot can't clear them. Bad-channel errors are left alone (already day-owned by
 * their rule). Non-overridden domains are untouched (snapshot-owned → animal).
 *
 * @param {Array} issues - Base validation issues.
 * @param {{ electrode_groups: boolean, ntrode: boolean }} prov - Geometry provenance.
 * @returns {Array} Issues with explicit day `ownerSurface`/`step`/`focusPath` on the
 *   day-overridden geometry errors; the focus anchor points at the override-removal control.
 */
function tagBaseOwnershipByProvenance(issues, prov) {
  if (!prov.electrode_groups && !prov.ntrode) return issues;
  return issues.map((issue) => {
    if (issue?.severity !== 'error') return issue;
    const domain = geometryDomainOf(issue);
    if (domain === 'electrode_groups' && prov.electrode_groups) {
      return { ...issue, ownerSurface: 'day', step: 'devices', focusPath: 'deviceOverrides.electrode_groups' };
    }
    if (domain === 'ntrode' && prov.ntrode) {
      return { ...issue, ownerSurface: 'day', step: 'devices', focusPath: 'deviceOverrides.ntrode_electrode_group_channel_map' };
    }
    return issue;
  });
}

/**
 * The closed vocabulary of per-step statuses `computeStepStatus` produces. Named + frozen so the
 * gate ({@link module:domain/stepGate}) and the workflow-status helper consume the same tokens
 * instead of re-typing string literals (which can drift). `'pending'` is reserved for steps awaiting
 * async work.
 *
 * @type {Readonly<{VALID:'valid', INCOMPLETE:'incomplete', ERROR:'error', PENDING:'pending'}>}
 */
export const STEP_STATUS = Object.freeze({
  VALID: 'valid',
  INCOMPLETE: 'incomplete',
  ERROR: 'error',
  PENDING: 'pending',
});

/**
 * Validates entire day and computes step status.
 *
 * @param {object} day - The day record.
 * @param {object} mergedDay - Merged animal + day metadata.
 * @param {object} [animal] - The owning animal (optional); folds raw animal-shape issues
 *   (e.g. a non-array `cameras`) into the export gate.
 * @returns {object} Status map per step.
 */
export function computeStepStatus(day, mergedDay, animal) {
  const issues = validateDay(day, mergedDay, animal);

  // Group errors by step
  const errorsByStep = groupErrorsByStep(issues);

  return {
    overview: getStepStatus(errorsByStep.overview, day.session),
    devices: computeDevicesStatus(day, mergedDay, errorsByStep.devices),
    epochs: computeEpochsStatus(day, errorsByStep.epochs),
    // (errorsByStep.epochs is scoped to task-path errors inside computeEpochsStatus)
    // The validation step owns the catch-all bucket (anything not routed to
    // overview/devices/epochs). It is in error only when that bucket has an
    // error-severity issue; an empty/clean catch-all reports valid so it stops
    // permanently disabling Export.
    validation: errorsByStep.validation.some(i => i.severity === 'error') ? STEP_STATUS.ERROR : STEP_STATUS.VALID,
    export: issues.filter(i => i.severity === 'error').length === 0 ? STEP_STATUS.VALID : STEP_STATUS.ERROR,
  };
}

/**
 * Computes the Epochs (Tasks & Epochs) step status from the day's tasks and the
 * task-level schema/rules errors.
 *
 * The status is driven by the day's **tasks**, with two exceptions that must badge
 * 'error' because their repair control renders on THIS step: a non-array `tasks`, and any
 * `malformed_day_collection` raw-shape error on an epochs-owned collection. Otherwise we
 * narrow the `epochs` error group to task-path errors (path references `tasks[…]`): the
 * group also collects behavioral-event and associated-file completeness concerns owned by
 * the later Validation step, not the Tasks & Epochs data-entry step.
 *
 * Severity policy: data entry is non-blocking except for blank schema-required
 * task fields (and epoch end <= start, which is blocked at the modal Save so it
 * cannot persist). Empty cameras, missing-camera references, no-epoch tasks, and
 * epoch overlaps are warnings/info and never mark the step in error.
 *
 * @param {object} day - Day record (reads `tasks`).
 * @param {Array} epochErrors - Issues grouped into the `epochs` step.
 * @returns {'incomplete'|'error'|'valid'}
 *   - `'incomplete'`: no tasks yet.
 *   - `'error'`: a task has an error-severity issue (e.g., a blank required field).
 *   - `'valid'`: at least one task and no task-level error-severity issues.
 */
export function computeEpochsStatus(day, epochErrors) {
  // A raw-shape corruption (`malformed_day_collection`) on any epochs-owned collection
  // (tasks / associated_files / associated_video_files / behavioral_events / fs_gui_yamls)
  // is a blocking error whose reset control renders ON this step — so the step badge must
  // read 'error', not a false 'incomplete'/'valid'. This generalizes the non-array-`tasks`
  // guard to the whole raw-shape family so the badge can't disagree with the reset notice.
  // The direct `day.tasks` check also covers a standalone call whose bucket isn't populated.
  if (day?.tasks != null && !Array.isArray(day.tasks)) return 'error';
  if ((epochErrors || []).some((i) => i.severity === 'error' && i.code === 'malformed_day_collection')) {
    return 'error';
  }
  const tasks = Array.isArray(day?.tasks) ? day.tasks : [];
  if (tasks.length === 0) return 'incomplete';

  const hasTaskError = (epochErrors || []).some(
    (issue) => issue.severity === 'error' && (issue.path || '').includes('task')
  );
  return hasTaskError ? 'error' : 'valid';
}

/**
 * Computes the Devices step status from the merged/effective electrode configuration
 * the export will encode. Mirrors the per-group health logic in
 * DevicesStep (getGroupStatus + the missing-channel-map branch) so the stepper and
 * the step content agree.
 *
 * @param {object} day - Day record (retained for call-site compatibility).
 * @param {object} mergedDay - Merged metadata (reads electrode_groups +
 *   ntrode_electrode_group_channel_map, including effective ntrode.bad_channels).
 * @param {Array} [deviceErrors] - Issues routed to the Devices step (from
 *   `groupErrorsByStep`). A DAY-owned error here (e.g. a stale/malformed device override,
 *   an out-of-range day bad channel) badges the step 'error' because its repair control
 *   renders ON this step — consistent with how `computeEpochsStatus`/`getStepStatus` badge
 *   their own step's repairable errors. ANIMAL-owned device schema errors routed here for
 *   grouping are deliberately NOT folded in: they are not day-repairable, and the export
 *   gate (not the badge) catches them — the documented "the gate is not redundant with the
 *   prereq steps" contract.
 * @returns {'incomplete'|'error'|'valid'}
 *   - `'incomplete'`: no electrode groups, or any group has no channel mapping.
 *   - `'error'`: a day-owned Devices error, or any group has all its channels marked bad.
 *   - `'valid'`: otherwise (bad-channel warnings are non-blocking).
 */
export function computeDevicesStatus(day, mergedDay, deviceErrors = []) {
  // A day-owned, Devices-step-repairable error must badge the step 'error' so a green badge
  // never sits beside its own blocking repair control. (Animal-owned errors excluded — see
  // the param doc / gate-non-redundancy contract.)
  if ((deviceErrors || []).some((i) => i.severity === 'error' && i.ownerSurface === 'day')) {
    return 'error';
  }

  const groups = mergedDay?.electrode_groups || [];
  const ntrodeMap = mergedDay?.ntrode_electrode_group_channel_map || [];

  if (groups.length === 0) return 'incomplete';

  let anyGroupAllBad = false;

  for (const group of groups) {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
    const ntrodes = ntrodeMap.filter((n) => n.electrode_group_id === group.id);

    // A group with no channel mapping is a data-completeness problem (corruption
    // branch in DevicesStep), surfaced as incomplete rather than a hard error.
    if (ntrodes.length === 0) return 'incomplete';

    let totalChannels = 0;
    let totalBadChannels = 0;
    for (const ntrode of ntrodes) {
      totalChannels += Object.keys(ntrode.map || {}).length;
      totalBadChannels += (Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : []).length;
    }
    if (totalChannels > 0 && totalBadChannels === totalChannels) {
      anyGroupAllBad = true;
    }
  }

  return anyGroupAllBad ? 'error' : 'valid';
}

/**
 * Determine step status from errors and data completeness.
 *
 * @private
 * @param {Array} errors - Validation issues for this step
 * @param {object} data - Step data to check completeness
 * @returns {'valid'|'incomplete'|'error'|'pending'}
 */
function getStepStatus(errors, data) {
  // A raw-shape corruption (`malformed_day_collection`, e.g. a non-array `keywords`) is a
  // blocking error whose reset control renders on this step — it must badge 'error' even
  // when other required fields are still blank, otherwise the corruption hides behind
  // 'incomplete'. (Plain missing-required-field errors keep the softer 'incomplete' below.)
  if ((errors || []).some((e) => e.severity === 'error' && e.code === 'malformed_day_collection')) {
    return 'error';
  }

  // Check completeness first - if data is incomplete, treat as incomplete
  // rather than error (even if validation would fail)
  if (!data || !isStepComplete(data)) {
    // Missing required data
    return 'incomplete';
  }

  if (errors && errors.length > 0) {
    // Has validation errors (but data is present)
    return 'error';
  }

  // All good
  return 'valid';
}

/**
 * Check if overview step has required fields.
 *
 * @private
 * @param {object} sessionData - Session metadata
 * @returns {boolean} True if all required fields present
 */
function isStepComplete(sessionData) {
  return !!(
    sessionData &&
    sessionData.session_id &&
    sessionData.session_description
  );
}

/**
 * Group validation errors by which step they belong to.
 *
 * @param {Array} errors - All validation issues
 * @returns {object} Errors grouped by step
 *
 * @example
 * const grouped = groupErrorsByStep(allErrors);
 * console.log(`Overview has ${grouped.overview.length} errors`);
 */
export function groupErrorsByStep(errors) {
  const groups = {
    overview: [],
    devices: [],
    epochs: [],
    validation: [],
    export: [],
  };

  errors.forEach(error => {
    groups[stepIdForIssue(error)].push(error);
  });

  return groups;
}

/**
 * Determine which editor step "owns" a single validation issue, by inspecting its
 * path. This is the single source of truth for issue→step routing, used both to
 * group the validation summary ({@link groupErrorsByStep}) and to route a repair
 * action to the step that can fix it.
 *
 * Routing degrades to the catch-all `validation` step when a path matches none of
 * the data-entry steps (e.g. a bare `required` artifact whose path is just the
 * missing property name).
 *
 * @param {{path?: string, instancePath?: string}} issue - A validation issue.
 * @returns {'overview'|'devices'|'epochs'|'validation'} The owning step id.
 */
export function stepIdForIssue(issue) {
  // Prefer an explicit, valid issue.step (set by validation rules) over path routing,
  // so a rule can land its repair action on the step that actually fixes it
  // (e.g. a camera-path issue routed to 'epochs'). Fall back to path routing when
  // step is absent or not a known data-entry step.
  const ROUTABLE_STEPS = ['overview', 'devices', 'epochs', 'validation'];
  if (issue?.step && ROUTABLE_STEPS.includes(issue.step)) {
    return issue.step;
  }

  const path = issue?.path || issue?.instancePath || '';

  // Session-related fields → Overview
  if (path.includes('session') || path.includes('subject') || path.includes('experimenter') || path.includes('lab') || path.includes('institution') || path.includes('experiment_description')) {
    return 'overview';
  }
  // FsGUI protocols are rendered in the Epochs step — route their schema errors there
  // BEFORE the camera/device check below (a `fs_gui_yamls[].camera_id` path contains
  // "camera" and would otherwise mis-route to Devices).
  if (path.includes('fs_gui')) {
    return 'epochs';
  }
  // Device-related fields → Devices
  if (
    path.includes('electrode') ||
    path.includes('device') ||
    path.includes('camera') ||
    path.includes('ntrode') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'devices';
  }
  // Task/behavioral fields → Epochs
  if (path.includes('task') || path.includes('behavioral') || path.includes('epoch') || path.includes('associated')) {
    return 'epochs';
  }
  // Everything else → Validation (catch-all)
  return 'validation';
}

/**
 * User-facing step names, the single source of truth for step→label mapping shared by
 * the repair-action buttons and the Validation summary's step-group headings (re-exported
 * from RepairActions for back-compat). The catch-all `validation` step reads as
 * "Other required fields".
 *
 * @type {Record<string, string>}
 */
export const STEP_LABELS = {
  overview: 'Overview',
  devices: 'Devices',
  epochs: 'Epochs',
  validation: 'Other required fields',
  export: 'Export',
};

/**
 * The valid repair surfaces. `day` issues are editable in the Day Editor's own steps;
 * `animal` issues are only editable in the Animal Editor (device geometry, channel
 * maps, cameras, data-acq devices, subject identity); `none` issues point at a
 * read-only identity (slash ids) with no in-app editable target.
 *
 * @type {Set<string>}
 */
const REPAIR_SURFACES = new Set(['day', 'animal', 'none']);

/**
 * Explicit surface for each app rule code (Repair Routing Contract). This is the
 * authoritative map: an issue's `repairSurface` (set by the rule) is preferred, but
 * this table is the fallback for app-rule codes and the single place the contract is
 * enumerated. Codes absent here fall through to path/code derivation (notably AJV
 * schema issues, which carry no app metadata).
 *
 * @type {Record<string, 'day'|'animal'|'none'>}
 */
export const SURFACE_BY_CODE = {
  // Editable ONLY in the Animal Editor (device geometry, channel maps, probe catalog,
  // electrode-group identity/location, cameras, data-acq devices, subject identity).
  channel_value_out_of_range: 'animal',
  channel_key_out_of_range: 'animal',
  channel_partition_invalid: 'animal',
  channel_row_count_mismatch: 'animal',
  inconsistent_probe_catalog: 'animal',
  empty_location: 'animal',
  empty_targeted_location: 'animal',
  inconsistent_location_case: 'animal',
  unknown_device_type: 'animal',
  duplicate_electrode_group_id: 'animal',
  duplicate_ntrode_id: 'animal',
  dangling_electrode_group_ref: 'animal',
  duplicate_channels: 'animal',
  missing_channels: 'animal',
  duplicate_camera_id: 'animal',
  divergent_camera_identity: 'animal',
  divergent_data_acq_identity: 'animal',
  // Editable in the Day Editor (task/video/event re-picks, day bad-channel overrides,
  // session metadata incl. the inherited subject fields repairable in Overview,
  // optogenetics completeness).
  invalid_species: 'day',
  dangling_camera_ref: 'day',
  duplicate_behavioral_event_name: 'day',
  duplicate_behavioral_event_description: 'day',
  duplicate_task_epoch: 'day',
  orphaned_video: 'day',
  orphaned_file: 'day',
  orphaned_fs_gui_epoch: 'day',
  divergent_task_identity: 'day',
  bad_channel_out_of_range: 'day',
  multishank_bad_channels_ignored: 'day',
  stale_bad_channel_override: 'day',
  malformed_bad_channel_override: 'day',
  malformed_device_override: 'day',
  shadowed_geometry_override: 'day',
  malformed_day_collection: 'day',
  malformed_day_session: 'day',
  unpinned_configuration: 'day',
  malformed_animal_collection: 'animal',
  missing_configuration_history: 'animal',
  missing_camera: 'day',
  // Optogenetics sections live on the Animal Editor's Optogenetics step (the rule also
  // sets repairSurface:'animal' explicitly; this keeps the authoritative table in sync).
  partial_configuration: 'animal',
  multiple_excitation_sources: 'animal',
  // No editable in-app target — read-only identity (slash ids). The explanatory
  // message states the remedy (recreate the animal); a "Fix in …" button would
  // dead-end on a disabled control.
  subject_id_slash: 'none',
  session_id_slash: 'none',
};

/**
 * Codes whose affected field is a read-only identity with no editable in-app target.
 * Kept distinct so the path/code FALLBACK (for schema issues) can honor them even when
 * the path otherwise looks like a subject/session field.
 *
 * @type {Set<string>}
 */
const NONE_CODES = new Set(['subject_id_slash', 'session_id_slash']);

/**
 * Derive the repair surface for an issue that carries no explicit `repairSurface` and
 * no app-rule code in {@link SURFACE_BY_CODE} — i.e. an AJV schema issue. Device
 * geometry, channel maps, cameras, data-acq devices, and subject identity are edited in
 * the Animal Editor; everything else (session/overview, tasks, catch-all) is edited in
 * the Day Editor. Slash-id codes have no editable target.
 *
 * @param {{code?: string, path?: string, instancePath?: string}} issue
 * @returns {'day'|'animal'|'none'}
 */
function deriveSurfaceFromPath(issue) {
  if (NONE_CODES.has(issue?.code)) return 'none';

  // Normalize an AJV instancePath ("/cameras/0/lens") so the same substring checks
  // work as for the app rules' dotted paths ("cameras[0].lens").
  const raw = issue?.path || issue?.instancePath || '';
  const path = raw.replace(/^\//, '').replace(/\//g, '.');

  // Read-only identity fields have no editable target on ANY step (subject_id is the
  // animal's identity; session_id is derived from it) — both are rendered read-only.
  // A generic SCHEMA error on them (not just the slash-specific app rules) must route
  // to 'none' (message only) rather than dead-ending on a disabled control.
  if (/(^|\.)subject_id($|\b)/.test(path) || /(^|\.)session_id($|\b)/.test(path)) {
    return 'none';
  }

  // Session/overview fields stay in the Day Editor. The inherited SUBJECT fields
  // (species/sex/genotype/DOB/weight/description) are repairable in the Day Editor
  // Overview step (the Animal Editor has no subject step), so they route to 'day'
  // too — check these BEFORE the device matches below.
  if (
    path.includes('session') ||
    path.includes('subject') ||
    path.includes('experimenter') ||
    path.includes('lab') ||
    path.includes('institution') ||
    path.includes('experiment_description')
  ) {
    return 'day';
  }

  // FsGUI protocols are DAY-level (epochs + camera refs live on the day). Route their
  // schema errors to the Day Editor — and BEFORE the camera check below, since a
  // `fs_gui_yamls[].camera_id` path contains "camera".
  if (path.includes('fs_gui')) return 'day';

  // Animal-level optogenetics sections (excitation source, optical fiber, virus injection,
  // software) are edited in the Animal Editor's Optogenetics step.
  if (path.includes('opto') || path.includes('virus') || path.includes('fiber')) {
    return 'animal';
  }

  // Animal-Editor-owned domains: electrode geometry, channel maps, cameras, data-acq devices.
  if (
    path.includes('electrode') ||
    path.includes('ntrode') ||
    path.includes('camera') ||
    path.includes('data_acq') ||
    path.includes('targeted_') ||
    path.includes('meters_per_pixel') ||
    path.includes('lens')
  ) {
    return 'animal';
  }

  // Everything else (tasks, behavioral events, catch-all required artifacts) → Day Editor.
  return 'day';
}

/**
 * The Animal Editor's steps, in order, with the field-path keywords that route to each.
 * Used to (a) deep-link an animal-surface repair to the right step and (b) give the
 * repair button a step-aware label. The Day Editor's repair routing already decides the
 * SURFACE (`animal`); this only resolves WHICH animal-editor step owns the field.
 *
 * @type {Array<{ index: number, label: string }>}
 */
export const ANIMAL_EDITOR_STEPS = [
  { index: 0, label: 'Electrode Groups' },
  { index: 1, label: 'Channel Maps' },
  { index: 2, label: 'Optogenetics' },
  { index: 3, label: 'Hardware Config' },
];

/**
 * Resolve which Animal Editor step owns a field path (for deep-linking + labeling an
 * animal-surface repair). Channel-map paths → Channel Maps; camera / data-acq paths →
 * Hardware Config; electrode-group geometry/identity (and anything else) → Electrode
 * Groups (the default first step). AJV instancePath slashes are normalized first.
 *
 * Note channel-map is checked BEFORE electrode-group because the channel-map path
 * (`ntrode_electrode_group_channel_map`) contains the substring "electrode_group".
 *
 * @param {string} [fieldPath] - Issue path (dotted app path or AJV instancePath).
 * @returns {{ index: number, label: string }} The owning step (defaults to step 0).
 */
export function animalEditorStepForFieldPath(fieldPath) {
  const path = String(fieldPath || '').replace(/^\//, '').replace(/\//g, '.');

  if (path.includes('ntrode')) return ANIMAL_EDITOR_STEPS[1];
  // Cameras, data-acq, and the device configuration history all live on the Hardware Config
  // step (the configurationHistory rebuild control is rendered in its corruption banner), so
  // their repairs deep-link there rather than defaulting to Electrode Groups.
  if (path.includes('camera') || path.includes('data_acq') || path.includes('configurationHistory')) {
    return ANIMAL_EDITOR_STEPS[3];
  }
  // Animal-level optogenetics sections (excitation source, optical fiber, virus injection,
  // software) live on the Optogenetics step. fs_gui paths are day-level and route to the
  // Day Editor (a different surface), not here.
  if (path.includes('opto') || path.includes('virus') || path.includes('fiber')) {
    return ANIMAL_EDITOR_STEPS[2];
  }
  // electrode geometry/identity + bare keyword paths (device_type/location/targeted_*).
  return ANIMAL_EDITOR_STEPS[0];
}

/**
 * The single source of truth for routing a repair action to the editable OWNER of a
 * problem (Repair Routing Contract). Returns the surface to navigate to, the Day-Editor
 * step (for `day` surface) or `null` (for `animal`/`none`), and the button label.
 *
 * Resolution order:
 *   1. an explicit `issue.repairSurface` (set by the app rule) wins;
 *   2. else the app-rule code's surface from {@link SURFACE_BY_CODE};
 *   3. else derive from path/code ({@link deriveSurfaceFromPath}) — the fallback for
 *      AJV schema issues, which carry no app metadata.
 *
 * For `day`, the owning step is {@link stepIdForIssue} (which itself honors an explicit
 * `issue.step`); the label is "Fix in {StepLabel}". For `animal`, the label is
 * "Fix in Animal Editor". For `none`, no button is rendered (the label is informational).
 *
 * @param {{code?: string, path?: string, instancePath?: string, step?: string, repairSurface?: string}} issue
 * @returns {{surface: 'day'|'animal'|'none', step: string|null, label: string}}
 */
export function repairTargetForIssue(issue) {
  // Boundary 2: an EXPLICIT ownerSurface (set by the producer or the provenance pass in
  // validateDay) wins — ownership is declared, not inferred from path. The legacy
  // repairSurface / SURFACE_BY_CODE / path-derivation chain is the fallback for issues
  // that don't yet carry explicit ownership (AJV schema issues in unambiguous domains).
  let surface =
    issue?.ownerSurface && REPAIR_SURFACES.has(issue.ownerSurface)
      ? issue.ownerSurface
      : issue?.repairSurface && REPAIR_SURFACES.has(issue.repairSurface)
        ? issue.repairSurface
        : SURFACE_BY_CODE[issue?.code];
  if (!surface) {
    surface = deriveSurfaceFromPath(issue);
  }

  if (surface === 'animal') {
    // Step-aware label so the user knows which Animal Editor step the fix lives in.
    const { label: stepLabel } = animalEditorStepForFieldPath(issue?.path || issue?.instancePath);
    return { surface: 'animal', step: null, label: `Fix in Animal Editor → ${stepLabel}` };
  }
  if (surface === 'none') {
    return { surface: 'none', step: null, label: 'No in-app fix' };
  }

  // Day surface: route to the owning Day-Editor step.
  const step = stepIdForIssue(issue);
  const stepLabel = STEP_LABELS[step] || step;
  return { surface: 'day', step, label: `Fix in ${stepLabel}` };
}
