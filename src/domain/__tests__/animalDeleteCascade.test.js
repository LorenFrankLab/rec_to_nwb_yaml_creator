/**
 * Unit tests for getAnimalDeleteCascade — the honest blast-radius summary the type-to-confirm
 * delete dialog states. The store's guarded deleteAnimal removes ONLY the animal's OK index days;
 * it preserves wrong-owner records (they belong to another animal) and leaves recovered-unlinked
 * records (not in the index). The cascade count MUST match that — counting wrong-owner/orphan days
 * would over-promise a deletion the store doesn't perform. This pins those exclusions directly (they
 * were previously only covered through the workspace integration tests).
 */
import { describe, it, expect } from 'vitest';
import { getAnimalDeleteCascade, DOWNSTREAM_NOT_DELETED_NOTE } from '../animalDeleteCascade';

const okDay = (id, animalId, extra = {}) => ({ id, animalId, date: id, session: { session_id: id }, ...extra });

describe('getAnimalDeleteCascade', () => {
  it('counts only the OK (owned, present, indexed) days', () => {
    const animal = { id: 'remy', days: ['remy-1', 'remy-2'] };
    const days = { 'remy-1': okDay('remy-1', 'remy'), 'remy-2': okDay('remy-2', 'remy') };
    const cascade = getAnimalDeleteCascade('remy', animal, days);
    expect(cascade.ownedDayCount).toBe(2);
    expect(cascade.wrongOwnerCount).toBe(0);
    expect(cascade.orphanCount).toBe(0);
  });

  it('excludes wrong-owner records from the owned count and reports them separately', () => {
    // remy indexes a day whose record belongs to totoro — the store preserves it, so it must NOT
    // be counted as a deleted recording day.
    const animal = { id: 'remy', days: ['remy-1', 'totoro-1'] };
    const days = { 'remy-1': okDay('remy-1', 'remy'), 'totoro-1': okDay('totoro-1', 'totoro') };
    const cascade = getAnimalDeleteCascade('remy', animal, days);
    expect(cascade.ownedDayCount).toBe(1);
    expect(cascade.wrongOwnerCount).toBe(1);
  });

  it('excludes recovered-unlinked records (not in the index) from the owned count', () => {
    // remy-2 belongs to remy but is NOT in remy's index — the store walks the index only, so it
    // survives; the cascade reports it as an orphan, not a deleted day.
    const animal = { id: 'remy', days: ['remy-1'] };
    const days = { 'remy-1': okDay('remy-1', 'remy'), 'remy-2': okDay('remy-2', 'remy') };
    const cascade = getAnimalDeleteCascade('remy', animal, days);
    expect(cascade.ownedDayCount).toBe(1);
    expect(cascade.orphanCount).toBe(1);
  });

  it('flags hasArtifacts when any OWNED day was validated or exported (not from a wrong-owner day)', () => {
    const animal = { id: 'remy', days: ['remy-1', 'totoro-1'] };
    const days = {
      'remy-1': okDay('remy-1', 'remy'), // draft → no artifacts
      'totoro-1': okDay('totoro-1', 'totoro', { state: { exported: true } }), // wrong owner — ignored
    };
    expect(getAnimalDeleteCascade('remy', animal, days).hasArtifacts).toBe(false);

    const days2 = { 'remy-1': okDay('remy-1', 'remy', { state: { validated: true } }) };
    expect(getAnimalDeleteCascade('remy', { id: 'remy', days: ['remy-1'] }, days2).hasArtifacts).toBe(true);
  });

  it('tolerates a malformed animal (non-array days) → all-zero cascade', () => {
    const cascade = getAnimalDeleteCascade('remy', { id: 'remy', days: 'nope' }, {});
    expect(cascade).toEqual({ ownedDayCount: 0, wrongOwnerCount: 0, orphanCount: 0, hasArtifacts: false });
  });

  it('exposes the downstream-not-deleted caveat string', () => {
    expect(DOWNSTREAM_NOT_DELETED_NOTE).toMatch(/does not delete any YAML you already downloaded/i);
    expect(DOWNSTREAM_NOT_DELETED_NOTE).toMatch(/NWB|DANDI|Spyglass/);
  });
});
