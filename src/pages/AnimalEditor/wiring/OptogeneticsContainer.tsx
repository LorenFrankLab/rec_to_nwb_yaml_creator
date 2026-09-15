/**
 * OptogeneticsContainer — binds the animal-level optogenetics editor to the store.
 *
 * Resolves the animal from `animalId` and wires `onUpdate` to `updateAnimal`, so both the
 * (temporary) Animal Editor stepper and the tabbed Animal View render ONE implementation of the
 * optogenetics section without duplicating the store wiring.
 *
 * The animal setup is only the DEFAULT for new days: every existing day keeps the setup it recorded
 * (that is what it exports and what its epoch controls show). So after the default is edited, the
 * container names the days whose saved setup now differs and offers to apply the default to them —
 * explicitly, after a confirm — via `applyAnimalDefaultsToDays`.
 */
import { useState } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import { daysWithDivergentOptogenetics } from '../../../domain/dayCarryPolicy';
import { ConfirmDialog } from '../../../components/Modal';
import Button from '../../../components/ui/Button';
import { pluralize } from '../../../utils/pluralize';
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const animal = animalId ? model.workspace.animals[animalId] : null;
  if (!animal) return null;
  const divergent = daysWithDivergentOptogenetics(animal, model.workspace.days);
  const dayLabel = `${divergent.length} ${pluralize(divergent.length, 'recording day')}`;
  const dates = divergent
    .map((id) => {
      const day = model.workspace.days[id] as { date?: unknown } | undefined;
      return typeof day?.date === 'string' ? day.date : id;
    })
    .join(', ');
  return (
    <>
      <OptogeneticsStep
        animal={animal}
        onUpdate={(updates) => {
          actions.updateAnimal(animalId, updates);
          onAfterUpdate?.();
        }}
      />
      {divergent.length > 0 && (
        <p role="note">
          {dayLabel} recorded a different optogenetics setup than this default ({dates}). Each day keeps
          what it recorded unless you apply this setup to it.{' '}
          <Button variant="secondary" size="small" onClick={() => setConfirmOpen(true)}>
            Apply this setup to {dayLabel}…
          </Button>
        </p>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Apply the optogenetics setup to existing days?"
        message={`This replaces the saved optogenetics setup of ${dayLabel} (${dates}) with the animal's current setup, changing what those days export. Days already downloaded will read "Changed since download".`}
        confirmLabel={`Apply to ${divergent.length} ${pluralize(divergent.length, 'day')}`}
        onConfirm={() => {
          actions.applyAnimalDefaultsToDays(animalId, divergent, ['optogenetics']);
          setConfirmOpen(false);
          onAfterUpdate?.();
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
