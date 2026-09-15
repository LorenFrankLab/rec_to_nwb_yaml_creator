import { describe, it, expect } from 'vitest';
import {
  nearestEarlierDayId,
  nearestLaterDayId,
  previousWeightSuggestion,
  deriveDataFolderForDate,
} from '../dayCarryPolicy';

const animal = { subject: { weight: 400 }, days: ['r-2023-06-22', 'r-2023-07-02', 'r-2023-06-10'] };
const days = {
  'r-2023-06-10': { id: 'r-2023-06-10', date: '2023-06-10', session: { weight: 410 } },
  'r-2023-06-22': { id: 'r-2023-06-22', date: '2023-06-22', session: {} },
  'r-2023-07-02': { id: 'r-2023-07-02', date: '2023-07-02', session: { weight: 430 } },
};

describe('carry source selection', () => {
  it('defaults to the nearest EARLIER day, not the latest day overall (F2/F7)', () => {
    expect(nearestEarlierDayId(animal, days, '2023-06-25')).toBe('r-2023-06-22');
  });
  it('returns null (blank start) when no earlier day exists, and offers the nearest later day separately', () => {
    expect(nearestEarlierDayId(animal, days, '2023-06-01')).toBeNull();
    expect(nearestLaterDayId(animal, days, '2023-06-01')).toBe('r-2023-06-10');
  });
  it('tolerates a corrupt days map', () => {
    expect(nearestEarlierDayId(animal, 'nope', '2023-06-25')).toBeNull();
  });
});

describe('previousWeightSuggestion', () => {
  it('suggests the most recent EARLIER measured weight with its date — skipping days without one', () => {
    expect(previousWeightSuggestion(animal, days, '2023-06-25')).toEqual({ weight: 410, date: '2023-06-10', source: 'previous-day' });
  });
  it('never looks at a later day for a backfill', () => {
    expect(previousWeightSuggestion(animal, days, '2023-06-01')).toEqual({ weight: 400, date: null, source: 'animal-baseline' });
  });
  it('returns null when nothing is known', () => {
    expect(previousWeightSuggestion({ subject: {} }, {}, '2023-06-01')).toBeNull();
  });
});

describe('deriveDataFolderForDate', () => {
  it('rewrites the source date token to the new date', () => {
    expect(deriveDataFolderForDate('/stelmo/remy/20230622/', '2023-06-22', '2023-06-25')).toEqual({
      kind: 'derived',
      dataFolder: '/stelmo/remy/20230625/',
    });
  });
  it('copies an undated folder as is', () => {
    expect(deriveDataFolderForDate('/data/remy/', '2023-06-22', '2023-06-25')).toEqual({ kind: 'copied', dataFolder: '/data/remy/' });
  });
  it('refuses to copy a folder dated for some OTHER day (the review’s /data/20230702/ backfill case)', () => {
    expect(deriveDataFolderForDate('/data/20230702/', '2023-07-02', '2023-06-25').dataFolder).toBe('/data/20230625/');
    expect(deriveDataFolderForDate('/data/20230702/', '2023-06-30', '2023-06-25')).toEqual({ kind: 'stale-date', dataFolder: undefined });
  });
  it('rewrites an ISO-dated folder (the review’s /data/remy/2023-06-22/ case) instead of copying it unchanged', () => {
    expect(deriveDataFolderForDate('/data/remy/2023-06-22/', '2023-06-22', '2023-06-23')).toEqual({
      kind: 'derived',
      dataFolder: '/data/remy/2023-06-23/',
    });
    expect(deriveDataFolderForDate('/data/remy/2023-06-22/', '2023-06-30', '2023-06-23')).toEqual({ kind: 'stale-date', dataFolder: undefined });
  });
  it('does not treat an unrecognized date-like token as stable: a 6-digit or dotted date needs entry', () => {
    expect(deriveDataFolderForDate('/data/remy/230622/', '2023-06-22', '2023-06-23')).toEqual({ kind: 'stale-date', dataFolder: undefined });
    expect(deriveDataFolderForDate('/data/remy/2023.06.22/', '2023-06-22', '2023-06-23')).toEqual({ kind: 'stale-date', dataFolder: undefined });
    expect(deriveDataFolderForDate('/data/remy/06-22-2023/', '2023-06-22', '2023-06-23')).toEqual({ kind: 'stale-date', dataFolder: undefined });
  });
  it('a folder whose digits are not a date (a rig number, an animal id) is still a shared folder', () => {
    expect(deriveDataFolderForDate('/data/rig2/remy_1234/', '2023-06-22', '2023-06-23')).toEqual({ kind: 'copied', dataFolder: '/data/rig2/remy_1234/' });
  });
  it('yields nothing for a blank source', () => {
    expect(deriveDataFolderForDate('', '2023-06-22', '2023-06-25').kind).toBe('none');
    expect(deriveDataFolderForDate(undefined, '2023-06-22', '2023-06-25').kind).toBe('none');
  });
});
