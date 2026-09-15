/**
 * OptogeneticsContainer — binds the animal-level optogenetics editor to the store.
 *
 * Resolves the animal from `animalId` and wires `onUpdate` to `updateAnimal`, so both the
 * (temporary) Animal Editor stepper and the tabbed Animal View render ONE implementation of the
 * optogenetics section without duplicating the store wiring.
 *
 * The animal setup is only the DEFAULT for new days: every existing day keeps the setup it recorded
 * (that is what it exports and what its epoch controls show). So after the default is edited, the
 * container names the days whose saved setup now differs and offers to apply the default to the
 * days the scientist SELECTS — each listed with its current setup and download status — via
 * `applyAnimalDefaultsToDays`. A historical non-opto day is left alone unless it is ticked.
 */
import { useId, useState } from 'react';
import { useStoreContext } from '../../../state/StoreContext';
import { resolveDayOptogenetics } from '../../../state/workspaceSelectors';
import { daysWithDivergentOptogenetics } from '../../../domain/dayCarryPolicy';
import { optoFieldsPresence } from '../../../domain/optoCompleteness';
import { Modal } from '../../../components/Modal';
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

/** One-line description of a day's saved optogenetics setup. */
function describeSetup(setup: Record<string, unknown> | null): string {
  if (!setup) return 'no optogenetics';
  const presence = optoFieldsPresence(setup as Parameters<typeof optoFieldsPresence>[0]);
  const sources = Array.isArray(setup.opto_excitation_source) ? setup.opto_excitation_source.length : 0;
  const fibers = Array.isArray(setup.optical_fiber) ? setup.optical_fiber.length : 0;
  if (presence.count === 0) return 'no optogenetics';
  return `${sources} excitation ${pluralize(sources, 'source')}, ${fibers} ${pluralize(fibers, 'fiber')}`;
}

export default function OptogeneticsContainer({ animalId, onAfterUpdate }: OptogeneticsContainerProps) {
  const { model, actions } = useStoreContext();
  const titleId = useId();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const animal = animalId ? model.workspace.animals[animalId] : null;
  if (!animal) return null;
  const divergent = daysWithDivergentOptogenetics(animal, model.workspace.days);
  const countLabel = (n: number) => `${n} ${pluralize(n, 'recording day')}`;
  const rows = divergent.map((id) => {
    const day = model.workspace.days[id];
    return {
      id,
      date: typeof day?.date === 'string' ? day.date : id,
      setup: describeSetup(resolveDayOptogenetics(animal, day)),
      downloaded: Boolean(day?.exportReceipt),
    };
  });
  const openPicker = () => {
    setSelected(new Set(divergent));
    setPickerOpen(true);
  };
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const apply = () => {
    const ids = divergent.filter((id) => selected.has(id));
    if (ids.length > 0) actions.applyAnimalDefaultsToDays(animalId, ids, ['optogenetics']);
    setPickerOpen(false);
    onAfterUpdate?.();
  };
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
          {countLabel(divergent.length)} recorded a different optogenetics setup than this default. Each day keeps
          what it recorded unless you apply this setup to it.{' '}
          <Button variant="secondary" size="small" onClick={openPicker}>
            Apply this setup to {countLabel(divergent.length)}…
          </Button>
        </p>
      )}
      <Modal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Apply the optogenetics setup to which days?"
        titleId={titleId}
        footer={
          <>
            <Button variant="secondary" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={selected.size === 0} onClick={apply}>
              Apply to {selected.size} {pluralize(selected.size, 'day')}
            </Button>
          </>
        }
      >
        <p>
          The ticked days will export the animal&apos;s current setup instead of what they recorded. A day already
          downloaded will read &quot;Changed since download&quot;. Leave a day unticked to keep its own setup.
        </p>
        <ul>
          {rows.map((row) => (
            <li key={row.id}>
              <label>
                <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggle(row.id)} />{' '}
                {row.date} — currently {row.setup}
                {row.downloaded ? ' · downloaded' : ''}
              </label>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
