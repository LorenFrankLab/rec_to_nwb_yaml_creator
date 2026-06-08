/**
 * Animal-delete cascade summary — the blast radius of deleting one animal (Phase 4 lifecycle).
 *
 * The store's guarded `deleteAnimal` walks ONLY the animal's day INDEX (`getAnimalDayIds`), so it
 * removes exactly the OK days (index-resident, record present, owned). It does NOT touch wrong-owner
 * records (they belong to another animal) NOR recovered-unlinked records (not in the index, so they
 * survive as orphans). This computes the honest counts a confirm dialog must state — the deletable
 * day count, the preserved wrong-owner / surviving recovered counts, and whether any deletable day
 * may have produced a downloaded artifact (so the "downloaded files are not deleted" caveat shows).
 *
 * Shared by every animal-delete affordance (the picker ⋮, the header ⋮) so the cascade copy can't
 * drift between them.
 *
 * @module domain/animalDeleteCascade
 */
import { classifyAnimalDays, DAY_STATUS } from './dayRecovery';

/** The metadata-only caveat appended when a deletable day may have produced downloaded artifacts. */
export const DOWNSTREAM_NOT_DELETED_NOTE =
  ' This removes workspace metadata only — it does not delete any YAML you already downloaded, ' +
  'or any NWB file, DANDI asset, or Spyglass rows produced from it.';

/**
 * Whether a day record has been validated or exported — i.e. it may have produced a downloaded
 * YAML / downstream NWB. Tolerates a malformed (non-object) `state` on a recovered record.
 *
 * @param {object} record - A day record.
 * @returns {boolean} True if the day is validated or exported.
 */
function dayHasArtifacts(record) {
  const state = record?.state;
  if (!state || typeof state !== 'object' || Array.isArray(state)) return false;
  return !!state.validated || !!state.exported;
}

/**
 * Compute the delete cascade for an animal.
 *
 * @param {string} animalId - The animal's store key.
 * @param {object} animal - The animal record.
 * @param {object} days - The workspace day map (`model.workspace.days`).
 * @returns {{ ownedDayCount: number, wrongOwnerCount: number, orphanCount: number, hasArtifacts: boolean }}
 */
export function getAnimalDeleteCascade(animalId, animal, days) {
  const classified = classifyAnimalDays(animalId, animal, days);
  // OK-only: counting recovered-unlinked here would promise a deletion the store does not perform.
  const owned = classified.filter((d) => d.status === DAY_STATUS.OK);
  return {
    ownedDayCount: owned.length,
    wrongOwnerCount: classified.filter((d) => d.status === DAY_STATUS.WRONG_OWNER).length,
    orphanCount: classified.filter((d) => d.status === DAY_STATUS.RECOVERED_UNLINKED).length,
    hasArtifacts: owned.some((d) => dayHasArtifacts(d.record)),
  };
}
