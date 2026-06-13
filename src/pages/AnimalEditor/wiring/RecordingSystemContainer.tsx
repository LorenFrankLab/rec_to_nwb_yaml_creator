/**
 * RecordingSystemContainer — the data-acquisition device + technical defaults section.
 *
 * Owns the dataset-wide data-acq identity registry (so DataAcqSection can flag a divergent reuse
 * of a device name) and renders DataAcqSection. Hosted by the tabbed Animal View's recording-system
 * tab (the legacy stepper's HardwareConfigStep that originally shared this was removed in Phase 5).
 */
import { useMemo } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import type { Animal } from '../../../state/workspaceTypes';
import DataAcqSection from '../DataAcqSection';
import { collectDataAcqIdentities } from '../identitySafety';

interface RecordingSystemContainerProps {
  /** Animal record. */
  animal: Animal;
  /** Field-update callback (writes `data_acq_device`). */
  onFieldUpdate: (field: string, value: unknown) => void;
}

export default function RecordingSystemContainer({ animal, onFieldUpdate }: RecordingSystemContainerProps) {
  const { model } = useStoreContext();
  // Data-acq identities elsewhere in the dataset, for the DataAcqSection divergent-reuse check.
  // Exclude this animal's ENTIRE catalog (not just index 0): intra-catalog name collisions are caught
  // by the editor's own uniqueness check, so the cross-animal registry must carry only OTHER animals'
  // systems — otherwise editing one catalog entry could spuriously diverge against a sibling entry.
  const dataAcqRegistry = useMemo(
    () => collectDataAcqIdentities(model.workspace, { animalId: animal.id }),
    [model.workspace, animal.id]
  );
  return (
    <DataAcqSection animal={animal} onFieldUpdate={onFieldUpdate} dataAcqRegistry={dataAcqRegistry} />
  );
}
