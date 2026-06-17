/**
 * Unit tests for the recovery-review view-model (epoch-editor Phase 8).
 *
 * The recovery-review screen RENDERS the existing day-recovery classification — it must not recompute
 * or extend it. These tests pin that: the builder filters the shared ValidationSummary view-model to
 * the non-`ok` rows, carries each row's EXISTING repair command (removeDayReference / relinkDayReference
 * / unlinkDayReference — no new command), marks the only destructive one, and never drops a record.
 */
import { describe, it, expect } from 'vitest';
import {
  buildRecoveryReviewViewModel,
  type RecoveryReviewViewModel,
} from '../recoveryReviewViewModel';

/**
 * A workspace exercising every non-`ok` recovery class at once, plus one ordinary `ok` day that must
 * be filtered out. Distinct ids avoid the per-scenario fixtures' id collisions when combined.
 *
 * @returns The combined workspace.
 */
function recoveryWorkspace() {
  return {
    animals: {
      // wrong_owner: bean's index lists a record that declares owner `cleo`.
      bean: { id: 'bean', subject: { subject_id: 'bean' }, days: ['bean-shared'] },
      // ok: okboy indexes a record it genuinely owns (filtered out of the review).
      okboy: { id: 'okboy', subject: { subject_id: 'okboy' }, days: ['okboy-d1'] },
      // dangling_reference: remy's index points at a record that doesn't exist.
      remy: { id: 'remy', subject: { subject_id: 'remy' }, days: ['remy-missing'] },
      // recovered_unlinked: wilbur owns a record that its (empty) index doesn't list.
      wilbur: { id: 'wilbur', subject: { subject_id: 'wilbur' }, days: [] },
    },
    days: {
      'bean-shared': { id: 'bean-shared', animalId: 'cleo', date: '2023-06-24' },
      'okboy-d1': { id: 'okboy-d1', animalId: 'okboy', date: '2023-06-22' },
      'wilbur-unlinked': { id: 'wilbur-unlinked', animalId: 'wilbur', date: '2023-06-25' },
      // orphan_no_owner: declared owner `nobody` is not an animal, and no index lists it.
      'ghost-day': { id: 'ghost-day', animalId: 'nobody', date: '2023-06-26' },
    },
  };
}

/** Find the single review row of a given recovery class. */
const rowOf = (vm: RecoveryReviewViewModel, recovery: string) =>
  vm.needsReview.find((r) => r.recovery === recovery);

describe('buildRecoveryReviewViewModel', () => {
  it('surfaces every non-ok recovery class and filters out ok days', () => {
    const vm = buildRecoveryReviewViewModel(recoveryWorkspace());

    expect(vm.allClear).toBe(false);
    expect(vm.reviewCount).toBe(4);
    expect(vm.needsReview).toHaveLength(4);

    const classes = vm.needsReview.map((r) => r.recovery).sort();
    expect(classes).toEqual(
      ['dangling_reference', 'orphan_no_owner', 'recovered_unlinked', 'wrong_owner'].sort()
    );

    // The ok day is never surfaced (it isn't a recovery concern).
    expect(vm.needsReview.some((r) => r.dayId === 'okboy-d1')).toBe(false);
  });

  it('carries the EXISTING repair command for each repairable class (no new command)', () => {
    const vm = buildRecoveryReviewViewModel(recoveryWorkspace());

    // Dangling reference → removeDayReference, the only DESTRUCTIVE repair (it deletes the leftover).
    const dangling = rowOf(vm, 'dangling_reference')!;
    expect(dangling.repair?.command.id).toBe('removeDayReference');
    expect(dangling.repair?.command.target).toEqual({ animalId: 'remy', dayId: 'remy-missing' });
    expect(dangling.repair?.destructive).toBe(true);

    // Recovered-unlinked → relinkDayReference (constructive, not destructive).
    const recovered = rowOf(vm, 'recovered_unlinked')!;
    expect(recovered.repair?.command.id).toBe('relinkDayReference');
    expect(recovered.repair?.command.target).toEqual({ animalId: 'wilbur', dayId: 'wilbur-unlinked' });
    expect(recovered.repair?.destructive).toBe(false);

    // Wrong-owner → unlinkDayReference (record preserved under its real owner, not destructive).
    const wrong = rowOf(vm, 'wrong_owner')!;
    expect(wrong.repair?.command.id).toBe('unlinkDayReference');
    expect(wrong.repair?.command.target).toEqual({ animalId: 'bean', dayId: 'bean-shared' });
    expect(wrong.repair?.destructive).toBe(false);
  });

  it('orphan-no-owner has no in-app repair — only an explanatory message', () => {
    const vm = buildRecoveryReviewViewModel(recoveryWorkspace());
    const orphan = rowOf(vm, 'orphan_no_owner')!;
    expect(orphan.repair).toBeUndefined();
    expect(orphan.message).toMatch(/re-create|re-import/i);
  });

  it('every review row has a human title + detail (nothing rendered as a bare id)', () => {
    const vm = buildRecoveryReviewViewModel(recoveryWorkspace());
    for (const row of vm.needsReview) {
      expect(row.title.trim().length).toBeGreaterThan(0);
      expect(row.detail.trim().length).toBeGreaterThan(0);
      // The wrong-owner row names the real owner so the user knows where it goes.
      if (row.recovery === 'wrong_owner') expect(row.title).toMatch(/cleo/);
    }
  });

  it('passes the auto-recovered notice through verbatim', () => {
    const vm = buildRecoveryReviewViewModel(recoveryWorkspace(), 'Restored 2 sections — no data lost.');
    expect(vm.notice).toBe('Restored 2 sections — no data lost.');
  });

  it('reports all-clear for a clean workspace (no notice, no rows)', () => {
    const vm = buildRecoveryReviewViewModel({ animals: {}, days: {} });
    expect(vm.allClear).toBe(true);
    expect(vm.reviewCount).toBe(0);
    expect(vm.needsReview).toEqual([]);
    expect(vm.notice).toBeUndefined();
  });

  it('is all-clear for a workspace with only ok days, even with a notice', () => {
    const okOnly = {
      animals: { okboy: { id: 'okboy', subject: { subject_id: 'okboy' }, days: ['okboy-d1'] } },
      days: { 'okboy-d1': { id: 'okboy-d1', animalId: 'okboy', date: '2023-06-22' } },
    };
    const vm = buildRecoveryReviewViewModel(okOnly, 'A section was restored.');
    expect(vm.needsReview).toEqual([]);
    expect(vm.allClear).toBe(true);
    // The notice still shows (it's the load FYI), independent of the day classification.
    expect(vm.notice).toBe('A section was restored.');
  });

  it('tolerates a malformed workspace without throwing', () => {
    expect(() => buildRecoveryReviewViewModel(null)).not.toThrow();
    expect(() => buildRecoveryReviewViewModel(undefined)).not.toThrow();
    expect(buildRecoveryReviewViewModel(null).allClear).toBe(true);
  });
});
