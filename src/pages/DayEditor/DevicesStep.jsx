import { useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import DayRecordingSystem from './DayRecordingSystem';
import { reconcileAppliedToDays } from '../../state/configDiff';
import { resolveDayConfig } from '../../state/workspaceUtils';
import {
  getConfigHistory,
  getDataAcqDevices,
  getDayDataAcqDeviceName,
} from '../../state/workspaceSelectors';
import { rawRecord } from '../../components/rawPropTypes';
import { isMultiShankGroup, validBadChannelIds } from '../../domain/badChannels';
import { priorBadChannels, getBadChannelRemovalAcks } from '../../domain/badChannelMonotonicity';
import { useDayEditorContext } from './DayEditorContext';
import CamerasUsedSection from './CamerasUsedSection';
import OverrideCleanupSection from './OverrideCleanupSection';
import ConfigVersionPanel from './ConfigVersionPanel';
import ElectrodeGroupsAccordion from './ElectrodeGroupsAccordion';
import './DayEditor.scss';

/**
 * DevicesStep - Devices configuration step (Step 2 of Day Editor)
 *
 * Displays inherited electrode group configuration from animal level and allows
 * editing of day-specific bad channels. This is the only device configuration
 * that changes day-to-day as hardware channels fail over time.
 *
 * Phase 9c-3 split the step's view sections into focused siblings with no behavior change —
 * `CamerasUsedSection` (the 8C cameras-used checklist), `OverrideCleanupSection` (the
 * device-override repair controls), `ConfigVersionPanel` (the config-version indicator +
 * reconfiguration wizard), and `ElectrodeGroupsAccordion` (the per-group failed-channel editors).
 * This module owns the effective-config resolution, the bad-channel state/handlers, and composition.
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
 *
 * Reads its inputs from {@link DayEditorContext} inside the Day Editor; an isolated render may
 * pass the same fields as props (the context hook falls back to them).
 * @returns {JSX.Element}
 */
export default function DevicesStep(props) {
  const {
    animal,
    day,
    mergedDay,
    onFieldUpdate,
    animalKey = undefined,
    animalDays = undefined,
    actions = undefined,
  } = useDayEditorContext(props);
  // The store OWNER KEY (resolved by DayEditorStepper). Used for animal-editor links and the
  // reconfiguration write so a stale/missing `animal.id` record field can't misroute them; falls
  // back to `animal.id` for isolated renders that don't pass it.
  const ownerKey = animalKey ?? animal?.id;

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
      selectedName={getDayDataAcqDeviceName(day)}
      onSelect={(name) => onFieldUpdate('data_acq_device_name', name)}
    />
  );

  // Per-day "cameras used" checklist (Phase 8C). Self-hides when the animal has no cameras.
  // Rendered in both the empty-state and the main return.
  const camerasUsedSection = (
    <CamerasUsedSection animal={animal} day={day} mergedDay={mergedDay} onFieldUpdate={onFieldUpdate} />
  );

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

  // Bad-channel monotonicity: channels that were bad on an EARLIER same-config day and are NOT
  // yet acknowledged for THIS day. Un-marking one is a monotonicity exception, so BadChannelsEditor
  // intercepts it with a confirm prompt. (Channels already acked are filtered out so a re-toggle
  // after an ack doesn't re-prompt.) Empty when there is no cross-day context (isolated renders).
  const priorBadByNtrode = useMemo(() => {
    const prior = priorBadChannels(animal, day, Array.isArray(animalDays) ? animalDays : []);
    const acks = getBadChannelRemovalAcks(day);
    const result = {};
    Object.keys(prior).forEach((ntrodeId) => {
      const acked = new Set(Array.isArray(acks[ntrodeId]) ? acks[ntrodeId] : []);
      const remaining = prior[ntrodeId].filter((ch) => !acked.has(ch));
      if (remaining.length > 0) result[ntrodeId] = remaining;
    });
    return result;
  }, [animal, day, animalDays]);

  /**
   * Record an OFF-EXPORT acknowledgment that this day deliberately un-marks `channel` on
   * `ntrodeId` (a channel that was bad on an earlier same-config day). Written to
   * `day.state.badChannelRemovalAcks.<ntrodeId>` (never read by the export merge), UNIONed with
   * any existing acks so a prior acknowledgment is preserved. This clears the
   * `bad_channel_unfailed_without_ack` export block without restoring the channel.
   * @param {string} ntrodeId - The ntrode id (stringified).
   * @param {number} channel - The probe-local channel/electrode id being un-marked.
   */
  const handleAcknowledgeRemoval = useCallback((ntrodeId, channel) => {
    const existing = getBadChannelRemovalAcks(day)[ntrodeId];
    const prior = Array.isArray(existing) ? existing : [];
    const next = Array.from(new Set([...prior, channel])).sort((a, b) => a - b);
    onFieldUpdate(`state.badChannelRemovalAcks.${ntrodeId}`, next);
  }, [day, onFieldUpdate]);

  // The day's resolved ntrode-id set — the stale-key detection the override-cleanup classifier needs.
  const resolvedNtrodeIds = useMemo(
    () => new Set(ntrodeChannelMap.map((n) => String(n.ntrode_id))),
    [ntrodeChannelMap]
  );

  // MALFORMED / STALE OVERRIDE REPAIR (computed BEFORE the empty-state early return so a day with
  // malformed overrides but no electrode groups still gets its removal buttons — otherwise a repair
  // action lands on Devices with no control). The section self-hides when there is nothing to clean
  // up. Rendered in both the empty-state and the main return.
  const overrideCleanupSection = (
    <OverrideCleanupSection day={day} resolvedNtrodeIds={resolvedNtrodeIds} onFieldUpdate={onFieldUpdate} />
  );

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

  // Config-error state: resolveDayConfig threw (the animal's device configuration is
  // missing or corrupt). Fail closed with a single, truthful, Animal-Editor-pointing
  // repair instead of crashing the step.
  if (configError) {
    return (
      <div className="devices-step">
        <h2>Setup &amp; Failed Channels</h2>
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
        <h2>Setup &amp; Failed Channels</h2>
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
      <h2>Setup &amp; Failed Channels</h2>

      {recordingSystemPicker}

      {camerasUsedSection}

      {/* This day's relationship to shared animal setup: it USES an animal configuration
          version; probe geometry is edited in the shared animal setup, not here. */}
      <div className="inherited-notice">
        This day uses animal electrode configuration v{effectiveConfig.configurationVersion ?? '—'}.
        <a href={`#/animal/${ownerKey}/electrode-groups?field=electrode_groups`}>Edit shared animal electrode setup</a>
      </div>

      {/* Configuration-version indicator + reconfiguration entry point. */}
      {reconfig && (
        <ConfigVersionPanel
          reconfig={reconfig}
          day={day}
          animal={animal}
          ownerKey={ownerKey}
          onFieldUpdate={onFieldUpdate}
          actions={actions}
        />
      )}

      {/* Malformed / stale / shadowing override repair controls (see overrideCleanupSection). */}
      {overrideCleanupSection}

      {/* Failed channels are day-specific: marks here apply to THIS recording day only. */}
      <p className="field-help-text devices-failed-channels-intro">
        Mark failed channels for this recording day. These marks apply to this day only, not to
        all recordings on this configuration.
      </p>

      {/* Electrode groups (accordion) */}
      <ElectrodeGroupsAccordion
        electrodeGroups={electrodeGroups}
        ntrodeChannelMap={ntrodeChannelMap}
        badChannels={badChannels}
        ownerKey={ownerKey}
        onBadChannelsUpdate={handleBadChannelsUpdate}
        onBadChannelsBatchUpdate={handleBadChannelsBatchUpdate}
        priorBadByNtrode={priorBadByNtrode}
        onAcknowledgeRemoval={handleAcknowledgeRemoval}
        errors={errors}
        warnings={warnings}
      />
    </div>
  );
}

// The seven shared fields (animal/day/mergedDay/onFieldUpdate/animalKey/animalDays/actions) come
// from DayEditorContext in the Day Editor; these propTypes describe the isolated-render fallback,
// so the context-provided fields are NOT marked `.isRequired` (the stepper passes them via context,
// not as props).
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
  }),
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
  }),
  mergedDay: PropTypes.object,
  onFieldUpdate: PropTypes.func,
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
