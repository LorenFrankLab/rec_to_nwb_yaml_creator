import { useStoreContext } from '../../../state/StoreContext';
import { applyRepairCommand } from '../../../state/repairCommands';
import type { RepairCommand } from '../../../state/repairCommands';

/**
 * Store-bound field-update + repair callbacks for an animal's setup sections, so containers
 * don't each re-derive `(field, value) => updateAnimal(animalId, { [field]: value })`. Both the
 * (temporary) stepper-hosted containers and the tabbed Animal View use the same wiring.
 *
 * @param animalId - The animal being edited.
 * @returns The field-update and repair callbacks.
 */
export function useAnimalFieldUpdate(animalId: string) {
  const { model, actions } = useStoreContext();

  /** Update a single top-level animal field. */
  const handleFieldUpdate = (field: string, value: unknown) => {
    actions.updateAnimal(animalId, { [field]: value });
  };

  /** Execute a raw-shape corruption repair in place (same executor the editor banners use). */
  const handleRepair = (issue: { repairCommand?: unknown } | null | undefined) => {
    if (!issue?.repairCommand || !animalId) return;
    applyRepairCommand(issue.repairCommand as RepairCommand, {
      actions,
      animalId,
      animal: model.workspace.animals?.[animalId],
    });
  };

  return { handleFieldUpdate, handleRepair };
}
