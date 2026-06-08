import { useStoreContext } from '../../../state/StoreContext';
import { applyRepairCommand } from '../../../state/repairCommands';

/**
 * Store-bound field-update + repair callbacks for an animal's setup sections, so containers
 * don't each re-derive `(field, value) => updateAnimal(animalId, { [field]: value })`. Both the
 * (temporary) stepper-hosted containers and the tabbed Animal View use the same wiring.
 *
 * @param {string} animalId - The animal being edited.
 * @returns {{ handleFieldUpdate: Function, handleRepair: Function }}
 */
export function useAnimalFieldUpdate(animalId) {
  const { model, actions } = useStoreContext();

  /**
   * Update a single top-level animal field.
   * @param {string} field - Field key (e.g. `cameras`, `devices`).
   * @param {*} value - New value.
   */
  const handleFieldUpdate = (field, value) => {
    actions.updateAnimal(animalId, { [field]: value });
  };

  /**
   * Execute a raw-shape corruption repair in place (same executor the editor banners use).
   * @param {object} issue - A raw-shape issue carrying a `repairCommand`.
   */
  const handleRepair = (issue) => {
    if (!issue?.repairCommand || !animalId) return;
    applyRepairCommand(issue.repairCommand, {
      actions,
      animalId,
      animal: model.workspace.animals?.[animalId],
    });
  };

  return { handleFieldUpdate, handleRepair };
}
