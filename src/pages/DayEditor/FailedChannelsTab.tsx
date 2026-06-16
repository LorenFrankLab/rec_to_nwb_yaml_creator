import { useMemo, useCallback } from 'react';
import DayRecordingSystem from './DayRecordingSystem';
import { reconcileAppliedToDays } from '../../state/configDiff';
import { resolveDayConfig } from '../../state/workspaceUtils';
import {
  getConfigHistory,
  getDataAcqDevices,
  getDayDataAcqDeviceName,
} from '../../state/workspaceSelectors';
import { isMultiShankGroup, validBadChannelIds } from '../../domain/badChannels';
import { priorBadChannels, getBadChannelRemovalAcks } from '../../domain/badChannelMonotonicity';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { BadChannelMarkViewModel } from '../../viewModels/types';
import CamerasUsedSection from './CamerasUsedSection';
import OverrideCleanupSection from './OverrideCleanupSection';
import ConfigVersionPanel from './ConfigVersionPanel';
import type { ReconfigActions } from './ConfigVersionPanel';
import ElectrodeGroupsAccordion from './ElectrodeGroupsAccordion';
import type { Day } from '../../state/workspaceTypes';
import './DayEditor.scss';

/**
 * FailedChannelsTab — the day editor's **Failed channels** tab (folded from the former DevicesStep).
 *
 * Displays inherited electrode group configuration from animal level and allows editing of
 * day-specific bad channels — the only device configuration that changes day-to-day as hardware
 * channels fail over time. Also hosts the per-day recording-system picker and cameras-used checklist
 * (day-session setup that travels with this tab).
 *
 * The view sections are focused siblings with no behavior change —
 * `CamerasUsedSection` (the 8C cameras-used checklist), `OverrideCleanupSection` (the
 * device-override repair controls), `ConfigVersionPanel` (the config-version indicator +
 * reconfiguration wizard), and `ElectrodeGroupsAccordion` (the per-group failed-channel editors).
 * This module owns the effective-config resolution, the bad-channel state/handlers, and composition.
 *
 * Reads its inputs from {@link DayEditorContext} inside the Day Editor; an isolated render may
 * pass the same fields as props (the context hook falls back to them).
 */
interface FailedChannelsTabProps extends DayEditorBundle {
  /**
   * The view-model's per-channel bad-channel mark state (`vm.badChannels.marks`), threaded by the
   * DayEditorFrame. The bad-channel monotonicity un-mark gate (which prior-bad channels need an
   * acknowledgement) is read from it; an isolated render that omits it falls back to recomputing the
   * same state from the monotonicity domain.
   */
  badChannelMarks?: BadChannelMarkViewModel[];
}

export default function FailedChannelsTab(props: FailedChannelsTabProps) {
  const {
    animal,
    day,
    mergedDay,
    onFieldUpdate,
    animalKey = undefined,
    animalDays = undefined,
    actions = undefined,
  } = useDayEditorContext(props);
  const { badChannelMarks } = props;
  // The store OWNER KEY (resolved by DayEditorFrame). Used for animal-editor links and the
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
    // `version` is undefined ONLY on the configError path (the catch stub), which early-returns
    // before this panel renders — so returning null here is behavior-equivalent and narrows
    // `version` to `number` for the ConfigVersionPanel contract.
    if (version == null) return null;
    // Read history through the canonical selector: a corrupt non-array configurationHistory
    // (`|| []` preserves a string and would throw on `.find`) is rendered as no history.
    const history = getConfigHistory(animal);
    const snapshot = history.find((s) => s.version === version) || null;
    const daysById = Object.fromEntries(animalDays.map((d): [string, Day] => [d.id, d]));
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
      ntrodeChannelMap.map((ntrode): [string, number[]] => [
        String(ntrode.ntrode_id),
        Array.isArray(ntrode.bad_channels) ? ntrode.bad_channels : [],
      ])
    );
  }, [ntrodeChannelMap]);

  /**
   * Handle bad channels update
   * @param ntrodeId - Ntrode ID
   * @param badChannelArray - Array of bad channel numbers
   */
  const handleBadChannelsUpdate = useCallback((ntrodeId: string, badChannelArray: number[]) => {
    onFieldUpdate(`deviceOverrides.bad_channels.${ntrodeId}`, badChannelArray);
  }, [onFieldUpdate]);

  /**
   * Atomic write of the WHOLE bad_channels map. The Day Editor stepper rebuilds
   * `deviceOverrides` from a stale render closure and REPLACES it, so the multi-shank
   * probe-wide migration (which touches several ntrode rows at once) must write the
   * entire map in a single update — separate per-ntrode writes would race/clobber.
   * @param badChannelsObject - The complete `{ [ntrodeId]: number[] }` map.
   */
  const handleBadChannelsBatchUpdate = useCallback((badChannelsObject: Record<string, number[]>) => {
    onFieldUpdate('deviceOverrides.bad_channels', badChannelsObject);
  }, [onFieldUpdate]);

  // Bad-channel monotonicity: channels that were bad on an EARLIER same-config day and are NOT
  // yet acknowledged for THIS day. Un-marking one is a monotonicity exception, so BadChannelsEditor
  // intercepts it with a confirm prompt. (Channels already acked are filtered out so a re-toggle
  // after an ack doesn't re-prompt.) Empty when there is no cross-day context (isolated renders).
  //
  // Phase 3-g: read this from the view-model's bad-channel marks (`vm.badChannels.marks` — prior-bad
  // and not yet acknowledged) when the stepper threads them, so the un-mark gate renders the builder's
  // monotonicity truth. An isolated render that omits the marks falls back to the identical inline
  // computation from the monotonicity domain.
  const priorBadByNtrode = useMemo(() => {
    const result: Record<string, number[]> = {};
    if (badChannelMarks) {
      for (const mark of badChannelMarks) {
        if (mark.priorBad && !mark.acked) (result[mark.ntrodeId] ??= []).push(mark.channel);
      }
      return result;
    }
    const prior = priorBadChannels(animal, day, Array.isArray(animalDays) ? animalDays : []);
    const acks = getBadChannelRemovalAcks(day);
    Object.keys(prior).forEach((ntrodeId) => {
      const acked = new Set(Array.isArray(acks[ntrodeId]) ? acks[ntrodeId] : []);
      const remaining = prior[ntrodeId].filter((ch) => !acked.has(ch));
      if (remaining.length > 0) result[ntrodeId] = remaining;
    });
    return result;
  }, [badChannelMarks, animal, day, animalDays]);

  /**
   * Record an OFF-EXPORT acknowledgment that this day deliberately un-marks `channel` on
   * `ntrodeId` (a channel that was bad on an earlier same-config day). Written to
   * `day.state.badChannelRemovalAcks.<ntrodeId>` (never read by the export merge), UNIONed with
   * any existing acks so a prior acknowledgment is preserved. This clears the
   * `bad_channel_unfailed_without_ack` export block without restoring the channel.
   * @param ntrodeId - The ntrode id (stringified).
   * @param channel - The probe-local channel/electrode id being un-marked.
   */
  const handleAcknowledgeRemoval = useCallback((ntrodeId: string, channel: number) => {
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
    // OverrideCleanupSection's `day` is the tolerant `Record<string, unknown>` (it inspects a
    // possibly-corrupt `deviceOverrides`); a clean `Day` is a valid input — the interface lacks an
    // index signature, hence the cast.
    <OverrideCleanupSection day={day as unknown as Record<string, unknown>} resolvedNtrodeIds={resolvedNtrodeIds} onFieldUpdate={onFieldUpdate} />
  );

  /**
   * Validate bad channels
   * @param ntrodeId - Ntrode ID
   * @param badChannelArray - Array of bad channel numbers
   * @returns Error or warning message
   */
  const validateBadChannels = useCallback((ntrodeId: number | string, badChannelArray: number[]) => {
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
      isMultiShankGroup(group?.device_type as string, groupNtrodes.length) &&
      groupNtrodes[0]?.ntrode_id === ntrode.ntrode_id;

    const validChannels = validBadChannelIds({
      // The badChannels domain helpers declare `deviceType: string` but tolerate undefined at
      // runtime (a missing device_type yields an empty valid set); the erased cast keeps the call typed.
      deviceType: group?.device_type as string,
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
    const errors: Record<string, string> = {};
    const warnings: Record<string, string> = {};

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
          // `actions` is the loose bundle store-action bag; the reconfig panel needs the
          // `createConfigurationSnapshotAndApplyForward` action it always carries here.
          actions={actions as unknown as ReconfigActions}
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
