import { describe, it, expect } from 'vitest';
import {
  selectConfigurationForDate,
  configurationChoiceStatus,
  previewConfigurationForDates,
} from '../configurationSelection';
import type { Day } from '../../state/workspaceTypes';

const animal = {
  configurationHistory: [
    { version: 1, date: '2023-06-01', description: 'implant', devices: {}, appliedToDays: [] },
    { version: 2, date: '2023-07-01', description: 'lowered', devices: {}, appliedToDays: [] },
  ],
};

const day = (date: string, version: number, confirmed = false): Day =>
  ({
    id: `remy-${date}`,
    date,
    configurationVersion: version,
    provenance: { configuration: confirmed ? { source: 'explicit', confirmed: true } : { source: 'effective-date', confirmed: false } },
  }) as unknown as Day;

describe('selectConfigurationForDate (F2)', () => {
  it('a June 25 backfill gets the June 1 setup, even though a July 1 setup exists (the newest)', () => {
    expect(selectConfigurationForDate(animal, '2023-06-25')).toEqual({ version: 1, covered: true, effectiveDate: '2023-06-01' });
  });

  it('a day on/after the reconfiguration gets the new version', () => {
    expect(selectConfigurationForDate(animal, '2023-07-01').version).toBe(2);
    expect(selectConfigurationForDate(animal, '2023-07-02').version).toBe(2);
  });

  it('a day before every known effective date is pinned to the earliest version but NOT covered', () => {
    expect(selectConfigurationForDate(animal, '2023-05-20')).toEqual({ version: 1, covered: false, effectiveDate: '2023-06-01' });
  });

  it('a same-day reconfiguration resolves to the later version', () => {
    const twoOnOneDay = { configurationHistory: [...animal.configurationHistory, { version: 3, date: '2023-07-01', description: 're-lowered', devices: {}, appliedToDays: [] }] };
    expect(selectConfigurationForDate(twoOnOneDay, '2023-07-01').version).toBe(3);
  });

  it('ignores malformed snapshots and reports no version for an empty history', () => {
    expect(selectConfigurationForDate({ configurationHistory: 'nope' }, '2023-06-25').version).toBeNull();
    expect(selectConfigurationForDate({ configurationHistory: [{ version: 2.5, date: '2023-06-01' }, { version: 1, date: 'June' }] }, '2023-06-25').version).toBeNull();
  });

  it('accepts a bare history array', () => {
    expect(selectConfigurationForDate(animal.configurationHistory, '2023-06-25').version).toBe(1);
  });
});

describe('selectConfigurationForDate — entry-stamped version 1', () => {
  // The animal was created in the app on Sept 14 (v1's date is only its ENTRY stamp) and a
  // reconfiguration effective July 1 was recorded through the wizard.
  const entryStamped = {
    configurationHistory: [
      { version: 1, date: '2026-09-14', effectiveDateKnown: false, description: 'initial', devices: {}, appliedToDays: [] },
      { version: 2, date: '2023-07-01', description: 'lowered', devices: {}, appliedToDays: [] },
    ],
  };

  it('a June 23 day gets v1 (the earliest setup by construction), unconfirmed — never the July 1 v2', () => {
    expect(selectConfigurationForDate(entryStamped, '2023-06-23')).toEqual({ version: 1, covered: false, effectiveDate: '2026-09-14' });
  });

  it('a July 5 day is covered by v2', () => {
    expect(selectConfigurationForDate(entryStamped, '2023-07-05')).toEqual({ version: 2, covered: true, effectiveDate: '2023-07-01' });
  });
});

describe('configurationChoiceStatus', () => {
  it('is confirmed when the pinned version’s effective date covers the recording date', () => {
    expect(configurationChoiceStatus(animal, day('2023-06-25', 1))).toMatchObject({ status: 'confirmed', version: 1 });
  });

  it('flags a day pinned to a version whose effective date is AFTER the recording (the reproduced bug)', () => {
    expect(configurationChoiceStatus(animal, day('2023-06-25', 2))).toMatchObject({
      status: 'unconfirmed',
      version: 2,
      effectiveDate: '2023-07-01',
      reason: 'before-effective-date',
    });
  });

  it('names an unknown effective period when the version-1 date is only the entry stamp', () => {
    const stamped = { configurationHistory: [{ version: 1, date: '2026-09-14', effectiveDateKnown: false, description: 'Initial configuration', devices: {}, appliedToDays: [] }] };
    expect(configurationChoiceStatus(stamped, day('2023-06-25', 1))).toMatchObject({ status: 'unconfirmed', reason: 'unknown-period' });
  });

  it('an explicit user confirmation settles the choice', () => {
    expect(configurationChoiceStatus(animal, day('2023-05-20', 1, true))).toMatchObject({ status: 'confirmed' });
    const explicit = { ...day('2023-05-20', 1, true), provenance: { configuration: { source: 'explicit', confirmed: true } } } as unknown as Day;
    expect(configurationChoiceStatus(animal, explicit)).toMatchObject({ status: 'confirmed' });
  });

  it('an AUTOMATIC (date-selected) confirmation is re-evaluated: moving v1’s effective date after the day un-confirms it', () => {
    const auto = { ...day('2023-06-25', 1), provenance: { configuration: { source: 'effective-date', confirmed: true } } } as unknown as Day;
    expect(configurationChoiceStatus(animal, auto)).toMatchObject({ status: 'confirmed' });
    const moved = {
      configurationHistory: [
        { version: 1, date: '2023-07-01', description: 'implant', devices: {}, appliedToDays: [] },
        { version: 2, date: '2023-08-01', description: 'lowered', devices: {}, appliedToDays: [] },
      ],
    };
    expect(configurationChoiceStatus(moved, auto)).toMatchObject({ status: 'unconfirmed', version: 1, reason: 'before-effective-date' });
  });

  it('a derived confirmation is also re-evaluated against the NEXT setup: moving v2 before the day supersedes the v1 pin', () => {
    const auto = { ...day('2023-06-25', 1), provenance: { configuration: { source: 'effective-date', confirmed: true } } } as unknown as Day;
    const v2Earlier = {
      configurationHistory: [
        { version: 1, date: '2023-06-01', description: 'implant', devices: {}, appliedToDays: [] },
        { version: 2, date: '2023-06-20', description: 'lowered', devices: {}, appliedToDays: [] },
      ],
    };
    expect(configurationChoiceStatus(v2Earlier, auto)).toMatchObject({ status: 'unconfirmed', version: 1, reason: 'superseded', supersededBy: 2 });
    // The explicit exemption still holds.
    expect(configurationChoiceStatus(v2Earlier, day('2023-06-25', 1, true))).toMatchObject({ status: 'confirmed' });
  });

  it('reports an unpinned day', () => {
    expect(configurationChoiceStatus(animal, { id: 'x', date: '2023-06-25' } as unknown as Day)).toEqual({ status: 'unpinned' });
  });
});

describe('previewConfigurationForDates', () => {
  it('shows which dates receive each version across a reconfiguration', () => {
    const preview = previewConfigurationForDates(animal, ['2023-06-30', '2023-07-01', '2023-05-01']);
    expect(preview.map((p) => [p.date, p.version, p.covered])).toEqual([
      ['2023-06-30', 1, true],
      ['2023-07-01', 2, true],
      ['2023-05-01', 1, false],
    ]);
  });
});
