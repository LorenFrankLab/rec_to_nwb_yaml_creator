/**
 * v3 → v4 dated-facts migration: every previously effective export is reproduced, unresolved
 * historical choices are flagged for review, and nothing is invented (fix plan, increment 2).
 */
import { describe, it, expect } from 'vitest';
import { migrateDatedFactsV3ToV4 } from '../datedFactsMigration';
import { applyDayUpdates } from '../workspaceTransitions';
import { mergeDayMetadata } from '../workspaceUtils';
import { validateDay } from '../../domain/dayValidationComposer';
import { configurationChoiceStatus } from '../../domain/configurationSelection';
import { exportFreshnessStatus } from '../../domain/exportReceipt';
import { buildRealisticWorkspace } from '../../__tests__/fixtures/workspaceBuilders';

const OPTO = {
  opto_excitation_source: [{ name: 'laser', model_name: 'X', description: 'd', wavelength_in_nm: 470, power_in_W: 0.01, intensity_in_W_per_m2: 1 }],
  optical_fiber: [],
  virus_injection: [],
  optogenetic_stimulation_software: 'fsgui',
};

/**
 * A v3-shaped workspace: team / opto / description live on the animal only.
 *
 * @param {object} [opts]
 * @param {boolean} [opts.exported]
 * @param {boolean} [opts.validated]
 * @param {number} [opts.dayWeight]
 * @param {boolean} [opts.withOpto]
 * @param {string} [opts.dayDate]
 * @param {string|null} [opts.v2Date]
 * @returns {object}
 */
function v3Workspace({ exported = false, validated = false, dayWeight = undefined, withOpto = true, dayDate = '2023-06-22', v2Date = null } = {}) {
  const { animal, day } = buildRealisticWorkspace();
  const a = {
    ...animal,
    created: '2023-06-22T12:00:00.000Z',
    experiment_description: 'Animal default description',
    optogenetics: withOpto ? OPTO : undefined,
    configurationHistory: [
      { ...animal.configurationHistory[0], version: 1, date: '2023-06-22', description: 'Initial configuration' },
      ...(v2Date ? [{ ...animal.configurationHistory[0], version: 2, date: v2Date, description: 'Lowered' }] : []),
    ],
  };
  const d = {
    ...day,
    id: `remy-${dayDate}`,
    date: dayDate,
    session: { ...day.session, experiment_description: '', ...(dayWeight === undefined ? {} : { weight: dayWeight }) },
    state: { draft: !exported, validated, exported, ...(exported ? { exportedAt: '2023-06-23T00:00:00.000Z' } : {}) },
    configurationVersion: v2Date ? 2 : 1,
  };
  delete d.session.weight;
  if (dayWeight !== undefined) d.session.weight = dayWeight;
  delete d.experimenters;
  delete d.optogenetics;
  delete d.provenance;
  a.days = [d.id];
  return { version: '1.0.0', lastModified: 'x', animals: { remy: a }, days: { [d.id]: d }, settings: {} };
}

describe('migrateDatedFactsV3ToV4', () => {
  it('copies the animal team / opto / description onto the day so the v3 export is reproduced exactly', () => {
    const ws = v3Workspace({ exported: true });
    const out = migrateDatedFactsV3ToV4(ws);
    const animal = out.animals.remy;
    const day = out.days['remy-2023-06-22'];
    expect(day.experimenters).toEqual(ws.animals.remy.experimenters);
    expect(day.optogenetics).toEqual(OPTO);
    expect(day.session.experiment_description).toBe('Animal default description');
    const merged = mergeDayMetadata(animal, day);
    // What v3 exported for this day: the animal's team, opto and default description, and the
    // baseline weight (the day had no measurement but was downloaded).
    expect(merged.experimenter_name).toEqual(ws.animals.remy.experimenters.experimenter_name);
    expect(merged.opto_excitation_source).toEqual(OPTO.opto_excitation_source);
    expect(merged.experiment_description).toBe('Animal default description');
    expect(merged.subject.weight).toBe(485);
    expect(day.provenance.fields).toMatchObject({ experimenters: 'migration', optogenetics: 'migration', 'session.experiment_description': 'migration', 'session.weight': 'migration' });
  });

  it('BLOCKS a new export of a downloaded day whose weight was the animal baseline until it is confirmed or corrected', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: true }));
    const day = out.days['remy-2023-06-22'];
    expect(day.provenance.review).toEqual(['weight_from_baseline']);
    const issues = validateDay(day, mergeDayMetadata(out.animals.remy, day), out.animals.remy);
    const flag = issues.find((i) => i.code === 'weight_from_baseline');
    expect(flag?.severity).toBe('error');
    expect(flag?.repairCommand).toEqual({ type: 'confirmWeightMeasurement' });
  });

  it('does NOT invent a weight for a never-downloaded draft (it stays incomplete)', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: false }));
    const day = out.days['remy-2023-06-22'];
    expect(day.session.weight).toBeUndefined();
    expect(day.provenance.review).toBeUndefined();
    expect(mergeDayMetadata(out.animals.remy, day).subject.weight).toBeUndefined();
  });

  it('does NOT invent a weight for a validated-but-never-downloaded day either (validation is not a measurement)', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: false, validated: true }));
    const day = out.days['remy-2023-06-22'];
    expect(day.session.weight).toBeUndefined();
    expect(day.provenance.review).toBeUndefined();
    const issues = validateDay(day, mergeDayMetadata(out.animals.remy, day), out.animals.remy);
    expect(issues.some((i) => i.code === 'weight_from_baseline')).toBe(false);
    expect(issues.some((i) => i.severity === 'error')).toBe(true); // still incomplete, honestly
  });

  it('confirming the value (repair command) or entering a measured weight clears the block', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: true }));
    const day = out.days['remy-2023-06-22'];
    const confirmed = applyDayUpdates(day, { provenance: { review: [], fields: { 'session.weight': 'entered' } } }, 'now');
    expect(confirmed.provenance.review).toEqual([]);
    expect(validateDay(confirmed, mergeDayMetadata(out.animals.remy, confirmed), out.animals.remy).some((i) => i.code === 'weight_from_baseline')).toBe(false);
    const corrected = applyDayUpdates(day, { session: { weight: 491 } }, 'now');
    expect(corrected.provenance.review).toEqual([]);
    expect(corrected.provenance.fields['session.weight']).toBe('entered');
  });

  it('keeps a measured day weight untouched', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: true, dayWeight: 512 }));
    expect(out.days['remy-2023-06-22'].session.weight).toBe(512);
    expect(out.days['remy-2023-06-22'].provenance.review).toBeUndefined();
  });

  it('turns state.exported into an UNVERIFIED receipt naming the v3 download filename', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ exported: true }));
    const day = out.days['remy-2023-06-22'];
    expect(day.exportReceipt).toMatchObject({
      filename: '06222023_remy_metadata.yml',
      exportedAt: '2023-06-23T00:00:00.000Z',
      unverified: true,
      yamlStored: false,
    });
    expect(exportFreshnessStatus(out.animals.remy, day)).toBe('unverified');
  });

  it('marks the entry-stamped version-1 snapshot as effective-date-unknown', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace());
    expect(out.animals.remy.configurationHistory[0].effectiveDateKnown).toBe(false);
  });

  it('flags a day pinned to a version that became effective AFTER the recording (the F2 victim) for review, without rewriting the pin', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ dayDate: '2023-06-25', v2Date: '2023-07-01' }));
    const day = out.days['remy-2023-06-25'];
    expect(day.configurationVersion).toBe(2); // preserved, not silently re-pinned
    expect(day.provenance.configuration).toEqual({ source: 'migration', confirmed: false });
    expect(configurationChoiceStatus(out.animals.remy, day)).toMatchObject({ status: 'unconfirmed', reason: 'before-effective-date' });
    const issues = validateDay(day, mergeDayMetadata(out.animals.remy, day), out.animals.remy);
    expect(issues.some((i) => i.code === 'configuration_effective_date_unconfirmed' && i.severity === 'error')).toBe(true);
  });

  it('a day whose pinned version covers its date is confirmed', () => {
    const out = migrateDatedFactsV3ToV4(v3Workspace({ dayDate: '2023-07-05', v2Date: '2023-07-01' }));
    expect(out.days['remy-2023-07-05'].provenance.configuration.confirmed).toBe(true);
  });

  it('is idempotent and never mutates its input', () => {
    const ws = v3Workspace({ exported: true });
    const snapshot = JSON.stringify(ws);
    const once = migrateDatedFactsV3ToV4(ws);
    const twice = migrateDatedFactsV3ToV4(once);
    expect(JSON.stringify(ws)).toBe(snapshot);
    expect(twice).toEqual(once);
  });

  it('tolerates corrupt shapes (non-record days / animals, missing owner)', () => {
    const out = migrateDatedFactsV3ToV4({ animals: { a: 'nope' }, days: { d: 42, e: { id: 'e', animalId: 'ghost', session: 'x' } } });
    expect(out.animals.a).toBe('nope');
    expect(out.days.d).toBe(42);
    expect(out.days.e.provenance).toBeDefined();
  });
});
