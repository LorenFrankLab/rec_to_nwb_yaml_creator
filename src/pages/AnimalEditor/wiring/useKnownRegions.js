import { useMemo } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import { getAnimalElectrodeGroups } from '../../../state/workspaceSelectors';

/**
 * The canonical brain-region list seeded from regions already used across the workspace, so the
 * electrode-group modal can offer them and snap case-only variants. Memoized so a fresh array
 * reference doesn't defeat the modal's BrainRegionAutocomplete memo. Read through the canonical
 * selector so a single corrupt animal's non-array `electrode_groups` can't crash the sweep.
 *
 * @returns {string[]} Distinct, non-empty region names across all animals.
 */
export function useKnownRegions() {
  const { model } = useStoreContext();
  return useMemo(
    () => [
      ...new Set(
        Object.values(model.workspace.animals || {})
          .flatMap((a) => getAnimalElectrodeGroups(a))
          .flatMap((g) => [g.location, g.targeted_location])
          .filter((r) => typeof r === 'string' && r.trim() !== '')
      ),
    ],
    [model.workspace.animals]
  );
}
