/**
 * Export-block backstop for bad-channel monotonicity — a day whose effective bad-channel set
 * drops a channel that was bad on an EARLIER same-config day (without an off-export
 * acknowledgment) must produce an export-blocking `bad_channel_unfailed_without_ack` issue.
 * Acknowledged removals pass; a reconfiguration (different `configurationVersion`) legitimately
 * resets channels and never blocks; callers that pass no `animalDays` keep today's behavior.
 */
import { describe, it, expect } from 'vitest';
import { validateDay, computeStepStatus } from '../validation';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { applyDayUpdates } from '../../state/workspaceTransitions';
import { applyRepairCommand } from '../../state/repairCommands';
import { encodeYaml } from '../../io/yaml';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

// Build an EARLIER sibling day on the same config that marked extra bad channels on ntrode 1.
const earlierDayWithBad = (day, channels) => ({
  ...day,
  id: 'remy_20230601',
  date: '2023-06-01',
  configurationVersion: day.configurationVersion,
  deviceOverrides: { bad_channels: { 1: channels } },
});

describe('bad-channel monotonicity export-block rule', () => {
  it('blocks export when this day drops an earlier same-config day’s bad channel', () => {
    const { animal, day } = buildRealisticWorkspace();
    const earlier = earlierDayWithBad(day, [0, 1]); // ntrode 1 bad: 0,1 earlier
    // `day` itself marks nothing on ntrode 1 → dropped 0 and 1.
    const merged = mergeDayMetadata(animal, day);
    const animalDays = [earlier, day];

    const issues = validateDay(day, merged, animal, animalDays);
    const issue = issues.find((i) => i.code === 'bad_channel_unfailed_without_ack');
    expect(issue).toBeTruthy();
    expect(issue.severity).toBe('error');
    expect(issue.ownerSurface).toBe('day');
    expect(issue.step).toBe('devices');
    expect(issue.path).toBe('deviceOverrides.bad_channels.1');
    expect(issue.repairCommand).toBeTruthy();

    // The export gate fails closed; the Devices step badges error (its repair renders there).
    const status = computeStepStatus(day, merged, animal, animalDays);
    expect(status.export).toBe('error');
    expect(status.devices).toBe('error');
  });

  it('does NOT block when the removal is acknowledged (off-export ack)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const earlier = earlierDayWithBad(day, [0, 1]);
    const acked = { ...day, state: { ...day.state, badChannelRemovalAcks: { 1: [0, 1] } } };
    const merged = mergeDayMetadata(animal, acked);

    const issues = validateDay(acked, merged, animal, [earlier, acked]);
    expect(issues.some((i) => i.code === 'bad_channel_unfailed_without_ack')).toBe(false);
    expect(computeStepStatus(acked, merged, animal, [earlier, acked]).export).toBe('valid');
  });

  it('does NOT block across a DIFFERENT configurationVersion (reconfig resets channels)', () => {
    const { animal, day } = buildRealisticWorkspace();
    // Earlier day on v0 marked channels bad; this day pins v1 → not comparable.
    const earlier = { ...earlierDayWithBad(day, [0, 1]), configurationVersion: 0 };
    const merged = mergeDayMetadata(animal, day);

    const issues = validateDay(day, merged, animal, [earlier, day]);
    expect(issues.some((i) => i.code === 'bad_channel_unfailed_without_ack')).toBe(false);
  });

  it('does NOT block when called with no animalDays (back-compat)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);
    // No animalDays arg → no cross-day context → no regression issue, matching prior behavior.
    expect(validateDay(day, merged, animal).some((i) => i.code === 'bad_channel_unfailed_without_ack')).toBe(false);
    expect(computeStepStatus(day, merged, animal).export).toBe('valid');
  });

  it('the issue’s acknowledge repair command clears the export block (re-validate → no error)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const earlier = earlierDayWithBad(day, [0, 1]);
    const merged = mergeDayMetadata(animal, day);

    const issue = validateDay(day, merged, animal, [earlier, day]).find(
      (i) => i.code === 'bad_channel_unfailed_without_ack'
    );
    expect(issue.repairCommand.type).toBe('acknowledgeBadChannelRemovals');

    // Execute the repair against a tiny in-memory store that applies the ack to the day.
    let updatedDay = day;
    const actions = {
      updateDay: (_id, updates) => {
        updatedDay = applyDayUpdates(updatedDay, updates, 'now');
      },
    };
    applyRepairCommand(issue.repairCommand, { actions, dayId: day.id, day });

    // The ack lives off-export in day.state; re-validating the updated day clears the block.
    const mergedAfter = mergeDayMetadata(animal, updatedDay);
    expect(
      validateDay(updatedDay, mergedAfter, animal, [earlier, updatedDay]).some(
        (i) => i.code === 'bad_channel_unfailed_without_ack'
      )
    ).toBe(false);
  });

  it('the off-export ack is MERGE-NEUTRAL: a day with badChannelRemovalAcks exports byte-identical', () => {
    const { animal, day } = buildRealisticWorkspace();
    const withAck = {
      ...day,
      state: { ...day.state, badChannelRemovalAcks: { 1: [0, 1], 2: [3] } },
    };
    // mergeDayMetadata never reads `state`, so the merged export must be byte-for-byte identical.
    expect(encodeYaml(mergeDayMetadata(animal, withAck))).toBe(encodeYaml(mergeDayMetadata(animal, day)));
  });

  it('a monotonic day (keeps prior + adds more) does NOT block', () => {
    const { animal, day } = buildRealisticWorkspace();
    const earlier = earlierDayWithBad(day, [0]);
    const keeps = { ...day, deviceOverrides: { bad_channels: { 1: [0, 1] } } };
    const merged = mergeDayMetadata(animal, keeps);

    expect(
      validateDay(keeps, merged, animal, [earlier, keeps]).some(
        (i) => i.code === 'bad_channel_unfailed_without_ack'
      )
    ).toBe(false);
  });
});
