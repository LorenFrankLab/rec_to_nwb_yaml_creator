/**
 * Domain validation contract — preserves the issue list, ownership, repair targets, and
 * step statuses after extracting this app-wide behavior out of `pages/DayEditor/validation.js`.
 *
 * This locks the app-wide day-validation contract at the domain module so a future move or
 * refactor of `src/domain/validation.js` cannot silently change which issues a representative
 * valid/invalid day produces, who owns each, where its repair routes, or the per-step status
 * the export gate reads. The values asserted here are the observed current behavior; a diff is
 * a deliberate contract change requiring review, never an incidental refactor side effect.
 */
import { describe, it, expect } from 'vitest';
import {
  validateDay,
  computeStepStatus,
  repairTargetForIssue,
} from '../validation';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { getDataAcqDevices } from '../../state/workspaceSelectors';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

/**
 * Reduce an issue list to the stable contract fields (code → owner/step/repair).
 * @param issues
 */
const contractOf = (issues) =>
  issues.map((issue) => {
    const target = repairTargetForIssue(issue);
    return {
      code: issue.code,
      ownerSurface: issue.ownerSurface,
      step: issue.step,
      repairSurface: target.surface,
      repairStep: target.step,
    };
  });

describe('domain validation module preserves the issue list', () => {
  it('a clean configured day produces no issues and every step is valid', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    expect(validateDay(day, merged, animal)).toEqual([]);
    expect(computeStepStatus(day, merged, animal)).toEqual({
      overview: 'valid',
      devices: 'valid',
      epochs: 'valid',
      behavioral: 'valid',
      validation: 'valid',
      export: 'valid',
    });
  });

  it('a day referencing a non-existent recording system is BLOCKED (dangling_data_acq_ref, day/devices)', () => {
    // Guards the silent-substitution path: resolveDayDataAcqDevice would fall back to catalog[0] and
    // export a DIFFERENT acquisition device than the day recorded on. This must be surfaced, not laundered.
    const { animal, day } = buildRealisticWorkspace();
    const dayRef = { ...day, data_acq_device_name: 'Ghost rig (renamed/removed)' };
    const merged = mergeDayMetadata(animal, dayRef);

    const issues = validateDay(dayRef, merged, animal);
    const issue = issues.find((i) => i.code === 'dangling_data_acq_ref');
    expect(issue).toBeTruthy();
    expect(issue.ownerSurface).toBe('day');
    expect(issue.step).toBe('devices');
    expect(issue.severity).toBe('error');
  });

  it('a day referencing an EXISTING recording system by name is clean (no dangling issue)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const realName = getDataAcqDevices(animal)[0].name;
    const dayRef = { ...day, data_acq_device_name: realName };
    const merged = mergeDayMetadata(animal, dayRef);

    expect(validateDay(dayRef, merged, animal).some((i) => i.code === 'dangling_data_acq_ref')).toBe(false);
  });

  it('a recording-system CATALOG with the same name but divergent hardware is BLOCKED (divergent_data_acq_identity, animal)', () => {
    // The merge collapses the catalog to ONE exported device, so the merged-model identity rule
    // can never see a divergent duplicate — it must be caught at the raw animal catalog.
    const { animal, day } = buildRealisticWorkspace();
    const first = getDataAcqDevices(animal)[0];
    animal.devices.data_acq_device = [
      { ...first, name: 'SpikeGadgets', system: 'MCU' },
      { ...first, name: 'SpikeGadgets', system: 'ECU' }, // same name, different hardware
    ];
    const merged = mergeDayMetadata(animal, day);

    const issue = validateDay(day, merged, animal).find((i) => i.code === 'divergent_data_acq_identity');
    expect(issue).toBeTruthy();
    expect(issue.ownerSurface).toBe('animal');
    expect(issue.step).toBe('devices');
    expect(issue.severity).toBe('error');
  });

  it('skips blank-named catalog entries and reports a divergent name only ONCE (deduped)', () => {
    const { animal, day } = buildRealisticWorkspace();
    const first = getDataAcqDevices(animal)[0];
    // Two blank-named entries with divergent hardware carry no identity → not flagged.
    animal.devices.data_acq_device = [
      { ...first, name: '', system: 'MCU' },
      { ...first, name: '', system: 'ECU' },
    ];
    let merged = mergeDayMetadata(animal, day);
    expect(validateDay(day, merged, animal).some((i) => i.code === 'divergent_data_acq_identity')).toBe(false);
    // Three divergent same-name entries → exactly ONE issue (deduped by name).
    animal.devices.data_acq_device = [
      { ...first, name: 'Rig', system: 'A' },
      { ...first, name: 'Rig', system: 'B' },
      { ...first, name: 'Rig', system: 'C' },
    ];
    merged = mergeDayMetadata(animal, day);
    expect(
      validateDay(day, merged, animal).filter((i) => i.code === 'divergent_data_acq_identity')
    ).toHaveLength(1);
  });

  it('a catalog with identical same-named entries, or with unique names, raises no divergence', () => {
    const { animal, day } = buildRealisticWorkspace();
    const first = getDataAcqDevices(animal)[0];
    // Identical duplicates → same identity, allowed.
    animal.devices.data_acq_device = [{ ...first }, { ...first }];
    let merged = mergeDayMetadata(animal, day);
    expect(validateDay(day, merged, animal).some((i) => i.code === 'divergent_data_acq_identity')).toBe(false);
    // Distinct names → distinct identities, allowed.
    animal.devices.data_acq_device = [
      { ...first, name: 'Rig A', system: 'MCU' },
      { ...first, name: 'Rig B', system: 'ECU' },
    ];
    merged = mergeDayMetadata(animal, day);
    expect(validateDay(day, merged, animal).some((i) => i.code === 'divergent_data_acq_identity')).toBe(false);
  });

  it('a day with a channel, camera, and stale-override fault yields the exact contract', () => {
    const { animal, day } = buildRealisticWorkspace();
    const merged = mergeDayMetadata(animal, day);

    // Three faults across distinct owners: an out-of-range channel value (animal-owned
    // geometry), a dangling task camera reference (day-owned), and a stale day-level
    // bad-channel override keyed to a non-existent ntrode (day-owned overlay).
    merged.tasks[0].camera_id = [99];
    merged.ntrode_electrode_group_channel_map[1].map = { 0: 4, 1: 5, 2: 6, 3: 7 };
    const dayWithStaleOverride = {
      ...day,
      deviceOverrides: { bad_channels: { 999: [0] } },
    };

    const issues = validateDay(dayWithStaleOverride, merged, animal);

    expect(contractOf(issues)).toEqual([
      {
        code: 'channel_value_out_of_range',
        ownerSurface: 'animal',
        step: 'devices',
        repairSurface: 'animal',
        repairStep: null,
      },
      {
        code: 'dangling_camera_ref',
        ownerSurface: 'day',
        step: 'epochs',
        repairSurface: 'day',
        repairStep: 'epochs',
      },
      {
        code: 'stale_bad_channel_override',
        ownerSurface: 'day',
        step: 'devices',
        repairSurface: 'day',
        repairStep: 'devices',
      },
    ]);

    // The export gate fails closed; the owning data-entry steps badge per ownership.
    // Devices is 'error' here because the stale override is DAY-owned and its repair control
    // renders on the Devices step. (An ANIMAL-owned device SCHEMA error — like the
    // channel_value_out_of_range above — would NOT change the Devices badge: that is the
    // gate-non-redundancy contract, exercised by the export-gate isolation fixture.)
    expect(computeStepStatus(dayWithStaleOverride, merged, animal)).toEqual({
      overview: 'valid',
      devices: 'error',
      epochs: 'error',
      behavioral: 'valid',
      validation: 'valid',
      export: 'error',
    });
  });
});
