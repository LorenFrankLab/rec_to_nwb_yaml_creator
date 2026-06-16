/**
 * OptogeneticsContainer — binds the animal-level optogenetics editor to the store.
 *
 * Resolves the animal from `animalId` and wires `onUpdate` to `updateAnimal`, so both the
 * (temporary) Animal Editor stepper and the tabbed Animal View render ONE implementation of the
 * optogenetics section without duplicating the store wiring.
 */
import { useStoreContext } from '../../../state/StoreContext';
import OptogeneticsStep from '../OptogeneticsStep';

interface OptogeneticsContainerProps {
  /** The animal whose optogenetics setup to edit. */
  animalId: string;
  /**
   * Called after an optogenetics write commits. The host uses it to surface the animal-static
   * re-export consequence (opto is shared by every recording day). Optional — the legacy host
   * doesn't pass it.
   */
  onAfterUpdate?: () => void;
}

export default function OptogeneticsContainer({ animalId, onAfterUpdate }: OptogeneticsContainerProps) {
  const { model, actions } = useStoreContext();
  const animal = animalId ? model.workspace.animals[animalId] : null;
  if (!animal) return null;
  return (
    <OptogeneticsStep
      animal={animal}
      onUpdate={(updates) => {
        actions.updateAnimal(animalId, updates);
        onAfterUpdate?.();
      }}
    />
  );
}
