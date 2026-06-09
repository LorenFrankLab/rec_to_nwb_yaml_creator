import { useMemo, useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import ReadOnlyDeviceInfo from './ReadOnlyDeviceInfo';
import BadChannelsEditor from './BadChannelsEditor';
import ReconfigWizard from './ReconfigWizard';
import DayRecordingSystem from './DayRecordingSystem';
import { reconcileAppliedToDays } from '../../state/configDiff';
import { resolveDayConfig } from '../../state/workspaceUtils';
import { getConfigHistory, getDataAcqDevices, getAnimalCameras } from '../../state/workspaceSelectors';
import { inferredCameraKeys } from '../../state/cameraUsage';
import { rawRecord } from '../../components/rawPropTypes';
import { isMultiShankGroup, validBadChannelIds } from '../../domain/badChannels';
import { classifyDeviceOverrides } from '../../domain/deviceOverrides';
import './DayEditor.scss';

/**
 * DevicesStep - Devices configuration step (Step 2 of Day Editor)
 *
 * Displays inherited electrode group configuration from animal level and allows
 * editing of day-specific bad channels. This is the only device configuration
 * that changes day-to-day as hardware channels fail over time.
 *
 * Design: Accordion/collapsible sections (one per electrode group)
 * - All groups collapsed by default
 * - Status badges show health at-a-glance
 * - Failed channels editor prioritized (editable content first)
 * - Device config collapsible (secondary reference info)
 *
 * @param {object} props
 * @param {object} props.animal - Animal record (read-only context)
 * @param {object} props.day - Day record (editable)
 * @param {object} props.mergedDay - Merged animal + day for validation
 * @param {Function} props.onFieldUpdate - Callback: (fieldPath, value) => void
 * @param {object[]} [props.animalDays] - The animal's days (sorted by date); enables the
 *   configuration-version indicator + reconfiguration wizard. Omitted in isolated tests.
 * @param {object} [props.actions] - Store actions (`createConfigurationSnapshotAndApplyForward`);
 *   when provided, the reconfiguration wizard is available.
 * @param {string} [props.animalKey] - The resolved store owner key; used for animal-editor links
 *   and the reconfiguration write instead of the possibly-stale `animal.id`.
 * @returns {JSX.Element}
 */
export default function DevicesStep({ animal, day, mergedDay, onFieldUpdate, animalKey = undefined, animalDays = undefined, actions = undefined }) {
  // The store OWNER KEY (resolved by DayEditorStepper). Used for animal-editor links and the
  // reconfiguration write so a stale/missing `animal.id` record field can't misroute them; falls
  // back to `animal.id` for isolated renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;
  const [wizardOpen, setWizardOpen] = useState(false);
  // Selected version for the unpinned-day repair control (a day with no pin in a multi-version
  // animal). Empty string = nothing chosen yet; pinning writes day.configurationVersion.
  const [pinVersion, setPinVersion] = useState('');

  // Render the day's EFFECTIVE (pinned) configuration, not live `animal.devices`.
  // On a historical day, `animal.devices` mirrors the *latest* version, so editing
  // bad channels against it would target the wrong ntrode list. `resolveDayConfig`
  // gives the snapshot the day is actually pinned to — matching what the export uses.
  // It THROWS by design on a missing/corrupt configurationHistory; catch it so a repair
  // routed here (or the step simply being reachable) renders a fail-closed, Animal-Editor-
  // pointing message instead of crashing the editor.
  const { effectiveConfig, configError } = useMemo(() => {
    try {
      return { effectiveConfig: resolveDayConfig(animal, day), configError: null };
    } catch (err) {
      return {
        effectiveConfig: { electrode_groups: [], ntrode_electrode_group_channel_map: [], configurationVersion: undefined },
        configError: err,
      };
    }
  }, [animal, day]);
  const electrodeGroups = effectiveConfig.electrode_groups;

  // The per-day recording-system selector (shown in every day setup — a behaviour-only day with no
  // electrodes still exports an acquisition device). The animal owns the catalog; this day references
  // one by name. Rendered in both the empty-state and the main return.
  const recordingSystemPicker = (
    <DayRecordingSystem
      catalog={getDataAcqDevices(animal)}
      selectedName={typeof day.data_acq_device_name === 'string' ? day.data_acq_device_name : undefined}
      onSelect={(name) => onFieldUpdate('data_acq_device_name', name)}
    />
  );

  // Per-day "cameras used" checklist. A camera INFERRED-referenced by a task/video/fs-gui row is
  // used regardless (shown checked + disabled — it cannot be unchecked here). A non-inferred camera
  // is a free checkbox whose checked state = its id is in the explicit `day.cameras_used` set, and
  // it stays ENABLED so the user can toggle it. The disabled/hint decision MUST use the INFERRED
  // set (not the export union, which folds in `cameras_used`) — otherwise checking a free camera
  // would immediately disable it and the user could never uncheck it. Toggling writes ONLY the
  // explicit additions (inferred cameras are covered by the union and need not be stored), so
  // `cameras_used` stays absent/empty for all existing data and the export stays byte-identical.
  const animalCameras = getAnimalCameras(animal);
  const referencedKeys = useMemo(() => inferredCameraKeys(day), [day]);
  const explicitCameraIds = useMemo(
    () => (Array.isArray(day.cameras_used) ? day.cameras_used : []),
    [day.cameras_used]
  );
  const explicitKeySet = useMemo(
    () => new Set(explicitCameraIds.map((id) => String(id))),
    [explicitCameraIds]
  );

  /**
   * Toggle a NON-referenced camera in the explicit cameras-used set. Rebuilds the set from the
   * full catalog so it stores the ids (in catalog order) of every currently-checked non-referenced
   * camera — referenced cameras are intentionally excluded (covered by the union).
   * @param {*} cameraId - The catalog camera id being toggled.
   * @param {boolean} checked - The next checked state.
   */
  const handleCameraUsedToggle = useCallback(
    (cameraId, checked) => {
      const next = new Set(explicitCameraIds.map((id) => String(id)));
      if (checked) next.add(String(cameraId));
      else next.delete(String(cameraId));
      // Preserve original id types/order by filtering the catalog, never stringifying into the array.
      const nextIds = animalCameras
        .filter(
          (camera) =>
            !referencedKeys.has(String(camera?.id)) && next.has(String(camera?.id))
        )
        .map((camera) => camera.id);
      onFieldUpdate('cameras_used', nextIds);
    },
    [animalCameras, explicitCameraIds, referencedKeys, onFieldUpdate]
  );

  const camerasUsedSection =
    animalCameras.length > 0 ? (
      <section className="cameras-used-section" aria-label="Cameras used this day">
        <h3>Cameras used this day</h3>
        <p className="field-help-text">
          Check the cameras this recording day used. A camera already referenced by a task, video,
          or FsGUI protocol is used regardless and shown checked.
        </p>
        <ul className="cameras-used-list">
          {animalCameras.map((camera) => {
            const key = String(camera?.id);
            const referenced = referencedKeys.has(key);
            const checked = referenced || explicitKeySet.has(key);
            const label = `${camera?.camera_name ?? '(unnamed)'} (id ${camera?.id})`;
            return (
              <li key={key}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={referenced}
                    onChange={(e) => handleCameraUsedToggle(camera.id, e.target.checked)}
                  />
                  {label}
                  {referenced && (
                    <span className="cameras-used-hint"> — used by a task/video</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </section>
    ) : null;

  // Configuration-version legibility (only when wired with store actions + the
  // animal's days, i.e. inside the real Day Editor — not in isolated unit renders).
  const reconfigEnabled = !!actions && Array.isArray(animalDays) && animalDays.length > 0;

  const reconfig = useMemo(() => {
    if (!reconfigEnabled) return null;
    const version = effectiveConfig.configurationVersion;
    // Read history through the canonical selector: a corrupt non-array configurationHistory
    // (`|| []` preserves a string and would throw on `.find`) is rendered as no history.
    const history = getConfigHistory(animal);
    const snapshot = history.find((s) => s.version === version) || null;
    const daysById = Object.fromEntries(animalDays.map((d) => [d.id, d]));
    const appliedCount = (reconcileAppliedToDays(animal, daysById)[version] || []).length;
    const idx = animalDays.findIndex((d) => d.id === day.id);
    const prevDay = idx > 0 ? animalDays[idx - 1] : null;
    const candidateDays = idx >= 0 ? animalDays.slice(idx) : [day];
    const latestVersion = history.length > 0 ? history[history.length - 1].version : version;
    return { version, snapshot, appliedCount, prevDay, candidateDays, isLatest: version === latestVersion };
  }, [reconfigEnabled, animal, day, animalDays, effectiveConfig.configurationVersion]);

  // Wrap in useMemo to prevent changing on every render
  const ntrodeChannelMap = useMemo(() => {
    return effectiveConfig.ntrode_electrode_group_channel_map || [];
  }, [effectiveConfig.ntrode_electrode_group_channel_map]);

  // Effective bad channels by ntrode ID. `resolveDayConfig` has already applied the
  // day-level replacement semantics onto the pinned snapshot, so this is exactly the
  // channel state export will encode.
  const badChannels = useMemo(() => {
    return Object.fromEntries(
      ntrodeChannelMap.map((ntrode) => [
        String(ntrode.ntrode_id),
        Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : [],
      ])
    );
  }, [ntrodeChannelMap]);

  /**
   * Get ntrodes for a specific electrode group
   * @param {number} groupId - Integer electrode group ID
   * @returns {Array} Ntrodes belonging to this group
   */
  const getNtrodesForGroup = useCallback((groupId) => {
    // electrode_group_id and group ids are integers end-to-end (schema contract).
    return ntrodeChannelMap.filter(ntrode => ntrode.electrode_group_id === groupId);
  }, [ntrodeChannelMap]);

  /**
   * Calculate status for an electrode group
   * @param {number} groupId - Electrode group ID
   * @returns {object} { status: 'clean'|'warning'|'error', badChannelCount: number, allBad: boolean }
   */
  const getGroupStatus = useCallback((groupId) => {
    const ntrodes = getNtrodesForGroup(groupId);
    let totalBadChannels = 0;
    let totalChannels = 0;

    ntrodes.forEach(ntrode => {
      const ntrodeId = String(ntrode.ntrode_id);
      const currentBadChannels = badChannels[ntrodeId] || [];
      const channelCount = Object.keys(ntrode.map).length;

      totalBadChannels += currentBadChannels.length;
      totalChannels += channelCount;
    });

    const allBad = totalChannels > 0 && totalBadChannels === totalChannels;

    return {
      status: allBad ? 'error' : totalBadChannels > 0 ? 'warning' : 'clean',
      badChannelCount: totalBadChannels,
      allBad,
    };
  }, [badChannels, getNtrodesForGroup]);

  /**
   * Get status badge text and aria-label
   * @param {number} groupId - Electrode group ID
   * @returns {object} { text: string, ariaLabel: string, className: string }
   */
  const getStatusBadge = useCallback((groupId) => {
    const { badChannelCount, allBad } = getGroupStatus(groupId);

    if (allBad) {
      return {
        text: '⚠ All channels failed - Group inactive',
        ariaLabel: 'Status: All channels failed - Group inactive',
        className: 'status-error',
      };
    }

    if (badChannelCount > 0) {
      return {
        text: `⚠ ${badChannelCount} failed ${badChannelCount === 1 ? 'channel' : 'channels'}`,
        ariaLabel: `Status: ${badChannelCount} failed ${badChannelCount === 1 ? 'channel' : 'channels'}`,
        className: 'status-warning',
      };
    }

    return {
      text: '✓ All channels OK',
      ariaLabel: 'Status: All channels OK',
      className: 'status-clean',
    };
  }, [getGroupStatus]);

  /**
   * Handle bad channels update
   * @param {string} ntrodeId - Ntrode ID
   * @param {number[]} badChannelArray - Array of bad channel numbers
   */
  const handleBadChannelsUpdate = useCallback((ntrodeId, badChannelArray) => {
    onFieldUpdate(`deviceOverrides.bad_channels.${ntrodeId}`, badChannelArray);
  }, [onFieldUpdate]);

  /**
   * Atomic write of the WHOLE bad_channels map. The Day Editor stepper rebuilds
   * `deviceOverrides` from a stale render closure and REPLACES it, so the multi-shank
   * probe-wide migration (which touches several ntrode rows at once) must write the
   * entire map in a single update — separate per-ntrode writes would race/clobber.
   * @param {object} badChannelsObject - The complete `{ [ntrodeId]: number[] }` map.
   */
  const handleBadChannelsBatchUpdate = useCallback((badChannelsObject) => {
    onFieldUpdate('deviceOverrides.bad_channels', badChannelsObject);
  }, [onFieldUpdate]);

  // MALFORMED / STALE OVERRIDE REPAIR: the merge declines to apply
  // any malformed `deviceOverrides` shape, so each blocks export (via `dayOverrideIssues`)
  // but has NO editor row — a repair dead-end. We surface a focusable removal control for
  // every such shape. The contract is: whatever `dayOverrideIssues` flags here is
  // repairable here. The shapes (mirroring that function):
  //   - a `bad_channels` KEY with no resolved ntrode_id (stale), OR a key whose VALUE is
  //     not a list (corrupt) → remove just that key;
  //   - the whole `bad_channels` CONTAINER is a scalar/array, not an ntrode→list map →
  //     remove the whole override;
  //   - a geometry override (`electrode_groups` / ntrode map) present but not an array →
  //     remove that override key.
  const resolvedNtrodeIds = useMemo(
    () => new Set(ntrodeChannelMap.map((n) => String(n.ntrode_id))),
    [ntrodeChannelMap]
  );
  // Malformed / stale / shadowing override classification. The converter-meaning decision
  // (which shapes the merge can't honor, partitioned for distinct removal labels) lives in
  // `classifyDeviceOverrides` — the editing-surface counterpart of the validator's
  // `dayOverrideIssues`. Whatever it flags is rendered with a removal control below.
  const {
    overridesRecord,
    wholeOverridesMalformed,
    badChannelContainer,
    badChannelContainerIsRecord,
    badChannelContainerMalformed,
    staleOverrideKeys,
    corruptValueKeys,
    presentGeometryKeys,
    hasOverrideCleanup,
  } = useMemo(() => classifyDeviceOverrides(day, resolvedNtrodeIds), [day, resolvedNtrodeIds]);

  /**
   * Remove a single bad-channel override key (stale or corrupt-value) via ONE atomic
   * write of the whole map minus that key. The container is a record here (guarded by
   * the callers), so spreading it is safe.
   * @param {string} key - The ntrode_id key to drop.
   */
  const handleRemoveOverrideKey = useCallback((key) => {
    const overrides = badChannelContainerIsRecord ? badChannelContainer : {};
    const next = { ...overrides };
    delete next[key];
    onFieldUpdate('deviceOverrides.bad_channels', next);
  }, [badChannelContainer, badChannelContainerIsRecord, onFieldUpdate]);

  /**
   * Remove an entire malformed override KEY off `deviceOverrides` (a scalar bad_channels
   * container, or a non-array geometry override). Rewrites the whole `deviceOverrides`
   * record without that key — `handleFieldUpdate` only SETS a path, so deleting a key
   * means writing the parent object minus it.
   * @param {string} overrideKey - 'bad_channels' | 'electrode_groups' | 'ntrode_electrode_group_channel_map'.
   */
  const handleRemoveOverride = useCallback((overrideKey) => {
    const next = { ...(overridesRecord || {}) };
    delete next[overrideKey];
    onFieldUpdate('deviceOverrides', next);
  }, [overridesRecord, onFieldUpdate]);

  /**
   * Validate bad channels
   * @param {number|string} ntrodeId - Ntrode ID
   * @param {number[]} badChannelArray - Array of bad channel numbers
   * @returns {object|null} Error or warning message
   */
  const validateBadChannels = useCallback((ntrodeId, badChannelArray) => {
    const ntrode = ntrodeChannelMap.find(n => String(n.ntrode_id) === String(ntrodeId));
    if (!ntrode) return null;

    // For a MULTI-shank group the first ntrode row carries PROBE-LOCAL indices
    // spanning all shanks (0..N-1), so its valid range is the whole probe, not just
    // that row's map keys. (Matches the probe-wide selector + converter semantics.)
    const group = electrodeGroups.find((g) => g.id === ntrode.electrode_group_id);
    const groupNtrodes = ntrodeChannelMap.filter(
      (n) => n.electrode_group_id === ntrode.electrode_group_id
    );
    const isMultiShankFirstRow =
      isMultiShankGroup(group?.device_type, groupNtrodes.length) &&
      groupNtrodes[0]?.ntrode_id === ntrode.ntrode_id;

    const validChannels = validBadChannelIds({
      deviceType: group?.device_type,
      isMultiShankFirstRow,
      rowMap: ntrode.map,
    });
    const invalidChannels = badChannelArray.filter(ch => !validChannels.includes(ch));

    if (invalidChannels.length > 0) {
      return {
        type: 'error',
        message: `Invalid channels: ${invalidChannels.join(', ')}. Valid channels are: ${validChannels.join(', ')}`,
      };
    }

    // Warning: All channels marked as bad
    if (badChannelArray.length === validChannels.length && badChannelArray.length > 0) {
      return {
        type: 'warning',
        message: `All ${badChannelArray.length} channels marked as failed. This electrode group will be excluded from analysis. Confirm this is intentional.`,
      };
    }

    return null;
  }, [ntrodeChannelMap, electrodeGroups]);

  // Compute validation errors and warnings
  const { errors, warnings } = useMemo(() => {
    const errors = {};
    const warnings = {};

    Object.keys(badChannels).forEach(ntrodeId => {
      const validation = validateBadChannels(ntrodeId, badChannels[ntrodeId]);
      if (validation) {
        if (validation.type === 'error') {
          errors[ntrodeId] = validation.message;
        } else if (validation.type === 'warning') {
          warnings[ntrodeId] = validation.message;
        }
      }
    });

    return { errors, warnings };
  }, [badChannels, validateBadChannels]);

  // Override cleanup controls (computed BEFORE the empty-state early return so a day
  // with malformed overrides but no electrode groups still gets its removal buttons —
  // otherwise a repair action lands on Devices with no control). The merge declines (or
  // mis-applies) each shape, so the export rule blocks it but there is no editor row.
  // Whatever `dayOverrideIssues` flags is removable here; the per-key bad-channel buttons
  // carry a KEY-SPECIFIC `data-field-path` so repair-focus lands on the clicked ntrode's
  // control, not the first matching one. `hasOverrideCleanup` comes from the classifier above.
  const overrideCleanupSection = hasOverrideCleanup ? (
    <section className="stale-overrides-section" aria-label="Corrupt or stale device overrides">
      <p className="field-help-text">
        This day has device overrides that need review. Corrupt or stale overrides block
        export; a shadowing override replaces the saved configuration for this day only.
        Remove any you did not intend:
      </p>

      {wholeOverridesMalformed && (
        <button
          type="button"
          className="stale-override-remove"
          data-field-path="deviceOverrides"
          onClick={() => onFieldUpdate('deviceOverrides', {})}
        >
          Remove corrupt device overrides
        </button>
      )}

      {staleOverrideKeys.map((staleKey) => (
        <button
          key={`stale-${staleKey}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.bad_channels.${staleKey}`}
          onClick={() => handleRemoveOverrideKey(staleKey)}
        >
          Remove stale failed-channel override for ntrode {staleKey}
        </button>
      ))}

      {corruptValueKeys.map((key) => (
        <button
          key={`corrupt-${key}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.bad_channels.${key}`}
          onClick={() => handleRemoveOverrideKey(key)}
        >
          Remove corrupt failed-channel override for ntrode {key}
        </button>
      ))}

      {badChannelContainerMalformed && (
        <button
          type="button"
          className="stale-override-remove"
          data-field-path="deviceOverrides.bad_channels"
          onClick={() => handleRemoveOverride('bad_channels')}
        >
          Remove corrupt failed-channel override
        </button>
      )}

      {presentGeometryKeys.map((key) => (
        <button
          key={`geom-${key}`}
          type="button"
          className="stale-override-remove"
          data-field-path={`deviceOverrides.${key}`}
          onClick={() => handleRemoveOverride(key)}
        >
          {Array.isArray(overridesRecord[key])
            ? `Remove ${key} override (revert to saved configuration)`
            : `Remove corrupt ${key} override`}
        </button>
      ))}
    </section>
  ) : null;

  // Config-error state: resolveDayConfig threw (the animal's device configuration is
  // missing or corrupt). Fail closed with a single, truthful, Animal-Editor-pointing
  // repair instead of crashing the step.
  if (configError) {
    return (
      <div className="devices-step">
        <h2>Devices Configuration</h2>
        <div className="error-state-inline" role="alert">
          <p>
            This animal&apos;s device configuration is missing or corrupt, so devices
            can&apos;t be shown for this day.
          </p>
          <a href={`#/animal/${ownerKey}/electrode-groups?field=electrode_groups`} className="button-primary">
            Configure devices in Animal Setup
          </a>
        </div>
      </div>
    );
  }

  // Empty state: No electrode groups. The override cleanup section still renders so a
  // malformed-override repair is reachable even with no groups configured.
  if (electrodeGroups.length === 0) {
    return (
      <div className="devices-step">
        <h2>Devices Configuration</h2>
        {recordingSystemPicker}
        {camerasUsedSection}
        {overrideCleanupSection}
        <div className="empty-state">
          <p>No electrodes are set up for {ownerKey} yet.</p>
          <p className="empty-state-hint">
            Electrodes/probes are shared animal setup. You can mark failed channels for this
            recording day only after electrodes exist.
          </p>
          <a href={`#/animal/${ownerKey}/electrode-groups?field=electrode_groups`} className="button-primary">
            Set Up Electrodes
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="devices-step">
      <h2>Devices Configuration</h2>

      {recordingSystemPicker}

      {camerasUsedSection}

      {/* This day's relationship to shared animal setup: it USES an animal configuration
          version; probe geometry is edited in the shared animal setup, not here. */}
      <div className="inherited-notice">
        This day uses animal electrode configuration v{effectiveConfig.configurationVersion ?? '—'}.
        <a href={`#/animal/${ownerKey}/electrode-groups?field=electrode_groups`}>Edit shared animal electrode setup</a>
      </div>

      {/* Configuration-version indicator + reconfiguration entry point. The wizard
          is a sibling of the bar (not nested inside the flex layout div) so the
          dialog is not a descendant of a layout container. */}
      {reconfig && (
        <>
          <div className="config-version-bar">
            <div className="config-version-info">
              <span className="config-version-label">
                Configuration version {reconfig.version}
                {reconfig.snapshot
                  ? `: ${reconfig.snapshot.description || 'No description'} (${reconfig.snapshot.date || 'date unknown'})`
                  : ''}
                <span
                  className={`config-version-tag config-version-tag-${reconfig.isLatest ? 'latest' : 'historical'}`}
                >
                  {reconfig.isLatest ? 'latest' : 'historical'}
                </span>
              </span>
              <span className="config-version-applied">
                {reconfig.isLatest
                  ? 'Mark failed channels for this recording day. Probe geometry is shared animal setup — edit it in Animal Setup.'
                  : 'This is a historical configuration. Mark failed channels for this recording day against this pinned snapshot; editing the latest animal setup will not change this day unless you reconfigure.'}
              </span>
              <span className="config-version-applied">
                Applied to {reconfig.appliedCount} {reconfig.appliedCount === 1 ? 'day' : 'days'}
              </span>
              {day.configurationVersion == null && getConfigHistory(animal).length > 1 && (
                <div className="config-version-warning" role="alert">
                  <span className="config-version-warning-text">
                    This day has no pinned configuration version. It is resolved to the latest
                    (v{reconfig.version}); if it recorded an earlier configuration, pin the correct
                    version before exporting.
                  </span>
                  {/* Repairable: assign an existing configuration version to this day. The
                      data-field-path is on the focusable <select> (not the wrapper) so the export
                      gate's "Fix in Devices" repair-focus actually moves keyboard/SR focus here. */}
                  <div className="config-version-pin">
                    <label htmlFor="pin-config-version">Pin this day to:</label>
                    <select
                      id="pin-config-version"
                      data-field-path="configurationVersion"
                      value={pinVersion}
                      onChange={(e) => setPinVersion(e.target.value)}
                    >
                      <option value="">Choose a version…</option>
                      {getConfigHistory(animal).map((snap) => (
                        <option key={snap.version} value={snap.version}>
                          v{snap.version}
                          {snap.description ? ` — ${snap.description}` : ''}
                          {snap.date ? ` (${snap.date})` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="config-version-pin-button"
                      disabled={pinVersion === ''}
                      onClick={() => onFieldUpdate('configurationVersion', Number(pinVersion))}
                    >
                      Pin version
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              className="config-reconfig-button"
              aria-haspopup="dialog"
              aria-expanded={wizardOpen}
              onClick={() => setWizardOpen(true)}
            >
              Hardware changed starting this day…
            </button>
          </div>
          <ReconfigWizard
            // Remount per day/version so reopening shows fresh form state.
            key={`${day.id}-${reconfig.version}`}
            isOpen={wizardOpen}
            onClose={() => setWizardOpen(false)}
            animal={animal}
            animalKey={ownerKey}
            day={day}
            prevDay={reconfig.prevDay}
            candidateDays={reconfig.candidateDays}
            actions={actions}
          />
        </>
      )}

      {/* Malformed / stale / shadowing override repair controls (see overrideCleanupSection). */}
      {overrideCleanupSection}

      {/* Failed channels are day-specific: marks here apply to THIS recording day only. */}
      <p className="field-help-text devices-failed-channels-intro">
        Mark failed channels for this recording day. These marks apply to this day only, not to
        all recordings on this configuration.
      </p>

      {/* Electrode groups (accordion) */}
      <section className="electrode-groups-section" aria-label="Electrode Groups">
        {electrodeGroups.map((group) => {
          const ntrodes = getNtrodesForGroup(group.id);
          const statusBadge = getStatusBadge(group.id);
          const ntrodeCount = ntrodes.length;

          // Check if this group has missing ntrode maps (data corruption)
          if (ntrodes.length === 0) {
            return (
              <details key={group.id} className="electrode-group-details">
                <summary className="electrode-group-summary">
                  <span className="electrode-group-label">
                    <span className="toggle-icon" aria-hidden="true">▶</span>
                    Electrode Group {group.id}: {group.location}
                  </span>
                  <span className="status-badge status-error" role="status" aria-label="Status: Error">
                    ⚠ No channel mapping
                  </span>
                </summary>

                <div className="electrode-group-content">
                  <div className="error-state-inline">
                    <p>⚠ No channel mapping found for this electrode group.</p>
                    <p>This usually indicates data corruption. Please review animal configuration.</p>
                    <a href={`#/animal/${ownerKey}/channel-maps?field=ntrode_electrode_group_channel_map`}>Fix in Animal Setup</a>
                  </div>
                </div>
              </details>
            );
          }

          return (
            <details key={group.id} className="electrode-group-details">
              <summary className="electrode-group-summary">
                <span className="electrode-group-label">
                  <span className="toggle-icon" aria-hidden="true">▶</span>
                  Electrode Group {group.id}: {group.location}
                </span>
                <span
                  className={`status-badge ${statusBadge.className}`}
                  role="status"
                  aria-label={statusBadge.ariaLabel}
                >
                  <span aria-hidden="true">
                    {statusBadge.text.split(' ')[0]}
                  </span>
                  {' '}
                  {statusBadge.text.split(' ').slice(1).join(' ')}
                </span>
              </summary>

              <div className="electrode-group-content">
                {/* Explanatory header */}
                <div className="electrode-group-header">
                  <h3>Electrode Group {group.id}: {group.location}</h3>
                  <p className="field-help-text">
                    This {group.device_type} has {ntrodeCount} {ntrodeCount === 1 ? 'shank' : 'shanks'}.
                    Mark individual channels that have failed on each shank.
                  </p>
                </div>

                {/* Failed Channels Editor (EDITABLE - prioritized at top) */}
                <BadChannelsEditor
                  ntrodes={ntrodes}
                  deviceType={group.device_type}
                  badChannels={badChannels}
                  onUpdate={handleBadChannelsUpdate}
                  onBatchUpdate={handleBadChannelsBatchUpdate}
                  errors={errors}
                  warnings={warnings}
                />

                {/* Device Configuration (READ-ONLY - collapsible, secondary) */}
                <details className="device-config-details">
                  <summary className="device-config-toggle">
                    <span className="toggle-icon" aria-hidden="true">▶</span>
                    View Device Configuration
                  </summary>
                  <ReadOnlyDeviceInfo group={group} />
                </details>
              </div>
            </details>
          );
        })}
      </section>
    </div>
  );
}

DevicesStep.propTypes = {
  animal: PropTypes.shape({
    id: PropTypes.string.isRequired,
    // Animal-level camera catalog (optional); rendered as the per-day cameras-used checklist.
    cameras: PropTypes.arrayOf(PropTypes.object),
    devices: PropTypes.shape({
      electrode_groups: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.number.isRequired,
          location: PropTypes.string.isRequired,
          device_type: PropTypes.string.isRequired,
          description: PropTypes.string.isRequired,
          targeted_location: PropTypes.string.isRequired,
          targeted_x: PropTypes.number.isRequired,
          targeted_y: PropTypes.number.isRequired,
          targeted_z: PropTypes.number.isRequired,
          units: PropTypes.string.isRequired,
        })
      ),
      ntrode_electrode_group_channel_map: PropTypes.arrayOf(
        PropTypes.shape({
          ntrode_id: PropTypes.number.isRequired,
          electrode_group_id: PropTypes.number.isRequired,
          bad_channels: PropTypes.arrayOf(PropTypes.number),
          map: PropTypes.objectOf(PropTypes.number).isRequired,
        })
      ),
    }),
  }).isRequired,
  day: PropTypes.shape({
    id: PropTypes.string.isRequired,
    animalId: PropTypes.string.isRequired,
    date: PropTypes.string.isRequired,
    // deviceOverrides is intentionally lossless: a malformed import can carry a corrupt
    // bad_channels container (scalar/array) or non-array geometry override. The component
    // detects and offers removal for each. rawRecord tolerates a non-record (scalar/array)
    // value too, so the PropType never warns on the corruption it exists to surface.
    deviceOverrides: rawRecord({}),
    // The explicit per-day "cameras used" checklist set (optional). Holds catalog camera ids of
    // cameras the day used but that are NOT inferred from a task/video/fs-gui row. Ids preserve
    // their source type (numeric or string from a corrupt import).
    cameras_used: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  }).isRequired,
  mergedDay: PropTypes.object.isRequired,
  onFieldUpdate: PropTypes.func.isRequired,
  // The resolved store owner key (from DayEditorStepper); animal-editor links + reconfiguration
  // use it instead of the possibly-stale `animal.id`. Omitted in isolated renders (falls back).
  animalKey: PropTypes.string,
  // animalDays + actions are supplied together by DayEditorStepper to enable the
  // configuration-version indicator and reconfiguration wizard; omitting both (e.g.
  // in isolated unit renders) simply hides that section.
  animalDays: PropTypes.arrayOf(PropTypes.object),
  actions: PropTypes.shape({
    createConfigurationSnapshotAndApplyForward: PropTypes.func,
  }),
};
