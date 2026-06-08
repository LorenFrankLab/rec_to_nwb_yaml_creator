/**
 * Animal Workspace View — the animal PICKER (Phase 1 — tabbed-workspace-ia).
 *
 * After the tab-shell conversion the Workspace is a pure picker + empty state: each animal card
 * is a LINK to `#/animal/:id/days`, where the tabbed {@link AnimalView} owns that animal's days
 * and setup. The per-animal recording-days pane lives in {@link RecordingDaysTab} (hosted by
 * AnimalView). Selecting an animal navigates to the route rather than rendering inline, so the
 * pane has exactly one home.
 *
 * @see docs/ANIMAL_WORKSPACE_DESIGN.md for UI mockups
 * @see docs/animal_hierarchy.md for data model
 */

import React, { useEffect, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { getPresentDayCount } from '../../domain/dayRecovery';
import { buildAnimalFromForm, getDefaultExperimenters } from '../../domain/animalCreation';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import OverflowMenu from '../../components/OverflowMenu';
import AnimalDeleteDialog from '../../components/AnimalDeleteDialog';
import AnimalProfileDialog from '../../components/AnimalProfileDialog';
import AnimalCreationForm from '../Home/AnimalCreationForm';
import './AnimalWorkspace.css';

/**
 * AnimalWorkspace Component
 *
 * The animal picker. Supports the post-create-day handshake `#/workspace?animal=<id>`, which now
 * navigates to that animal's days route (the animal experience lives at `#/animal/:id/:tab`).
 */
export function AnimalWorkspace() {
  const { model, actions } = useStoreContext();

  // Default the required sections so a workspace that somehow reaches here without them
  // renders its empty state instead of crashing on Object.keys(undefined).
  const { animals = {}, days = {} } = model.workspace;
  const animalIds = Object.keys(animals);
  const hasAnimals = animalIds.length > 0;

  // The animal id whose delete dialog is open (null when closed). Deleting is the highest-blast-
  // radius action, so it routes through the shared type-to-confirm AnimalDeleteDialog rather than a
  // menu-adjacent button. A single dialog instance serves whichever card's ⋮ opened it.
  const [pendingDeleteAnimalId, setPendingDeleteAnimalId] = useState(null);
  const pendingDeleteAnimal = pendingDeleteAnimalId ? animals[pendingDeleteAnimalId] : null;
  // The animal whose "Edit profile…" dialog is open (from a card ⋮) — same dialog as the header /
  // switcher, so subject facts are editable from wherever an animal is listed.
  const [pendingProfileAnimalId, setPendingProfileAnimalId] = useState(null);
  const pendingProfileAnimal = pendingProfileAnimalId ? animals[pendingProfileAnimalId] : null;

  // Whether the inline create-animal panel is open (Task 4.2). Create lives IN the workspace — an
  // inline panel on the picker, not a route to a separate `#/home` screen — so first-animal creation
  // uses the same pattern as everything else (this unblocks Phase 5's Home/stepper removal).
  const [showCreate, setShowCreate] = useState(false);

  /** Commit the pending animal deletion through the store's guarded deleteAnimal, then close. */
  const confirmDeleteAnimal = () => {
    const id = pendingDeleteAnimalId;
    setPendingDeleteAnimalId(null);
    if (id) actions.deleteAnimal(id);
  };

  /**
   * Create the animal from the inline panel's form submission (the SAME builder Home uses), then
   * land on the new animal's days route. createAnimal applies synchronously, so navigating
   * immediately is safe.
   * @param {object} formData - The processed AnimalCreationForm payload.
   */
  const handleCreate = (formData) => {
    const { animalId, subject, metadata } = buildAnimalFromForm(formData);
    // Defense-in-depth (same as Home): the store throws on a duplicate id from inside a React
    // updater, which can't be caught here — so guard before navigating, or a regressed form check
    // would silently navigate "into the new animal" while the create failed. The form already
    // enforces uniqueness; on collision we don't create or navigate.
    if (animals[animalId]) return;
    actions.createAnimal(animalId, subject, metadata);
    window.location.hash = `#/animal/${animalId}/days`;
  };

  // Handshake: `#/workspace?animal=<id>` (e.g. after creating a day) jumps straight to that
  // animal's days route. An unknown/absent `?animal` is ignored — the picker is shown. (Unlike
  // the old inline pane, a SOLE animal is NOT auto-opened: the picker stays reachable so "+ New
  // Animal" is always available; the user opens an animal by clicking its card.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const animalParam = params.get('animal');
    if (animalParam && animals[animalParam]) {
      // REPLACE (not push) the transient handshake URL so Back doesn't bounce the user back into
      // this redirect and forward again. replaceState doesn't fire `hashchange`, so notify the
      // router (useHashRouter) explicitly.
      window.history.replaceState(null, '', `#/animal/${animalParam}/days`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      return;
    }
    // `#/workspace?create=1` handshake (Task 4.5): the top selector's "+ New animal…" routes here to
    // open the inline create panel (Phase 4b), so create has ONE home. Strip the transient param so
    // Back / a reload doesn't reopen the panel.
    if (params.get('create') === '1') {
      setShowCreate(true);
      window.history.replaceState(null, '', '#/workspace');
    }
  }, []); // Run only on mount

  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      {showCreate ? (
        /* Inline create-animal panel (Task 4.2): the existing AnimalCreationForm, hosted ON the
           picker. On success we navigate to the new animal's days route; cancel just closes it. */
        <section className="create-animal-panel" aria-label="Create animal">
          <AnimalCreationForm
            onSubmit={handleCreate}
            onCancel={() => setShowCreate(false)}
            defaultExperimenters={getDefaultExperimenters(model.workspace)}
            existingAnimals={animals}
          />
        </section>
      ) : !hasAnimals ? (
        /* Empty State: No Animals */
        <div className="empty-state" role="region" aria-label="Empty workspace">
          <p className="empty-message">No animals created yet.</p>
          <p>Create your first animal to start managing recording sessions.</p>
          <button
            type="button"
            className="create-animal-link"
            onClick={() => setShowCreate(true)}
          >
            Create Animal
          </button>
        </div>
      ) : (
        /* Animal picker: each card links to the animal's tabbed view. */
        <nav className="animal-list" aria-label="Animal list">
          <div className="animal-list-header">
            <h2>Animals</h2>
            <button
              type="button"
              className="btn-create-animal"
              aria-label="Create new animal"
              onClick={() => setShowCreate(true)}
            >
              + New Animal
            </button>
          </div>
          {animalIds.map((animalId) => {
            const animal = animals[animalId];
            // Count day RECORDS present (indexed + recovered), via the shared recovery count, so a
            // missing/corrupt index doesn't under-count an animal with recovered records.
            const dayCount = getPresentDayCount(animalId, animal, days);

            return (
              <div key={animalId} className="animal-card">
                {/* The card link and the ⋮ menu are SIBLINGS: a menu button can't be nested in the
                    navigation <a> (interactive-in-interactive), and keeping them apart means the
                    destructive Delete can't be hit while opening the animal. */}
                <a className="animal-card-link" href={`#/animal/${animalId}/days`}>
                  <div className="animal-name">{animalId}</div>
                  <div className="animal-day-count">
                    {dayCount} {dayCount === 1 ? 'day' : 'days'}
                  </div>
                </a>
                <OverflowMenu
                  label={`Actions for ${animalId}`}
                  buttonClassName="animal-card-menu"
                  items={[
                    {
                      key: 'open',
                      label: 'Open',
                      onSelect: () => {
                        window.location.hash = `#/animal/${animalId}/days`;
                      },
                    },
                    {
                      key: 'edit-profile',
                      label: 'Edit profile…',
                      onSelect: () => setPendingProfileAnimalId(animalId),
                    },
                    {
                      key: 'delete',
                      label: 'Delete animal…',
                      onSelect: () => setPendingDeleteAnimalId(animalId),
                    },
                  ]}
                />
              </div>
            );
          })}
        </nav>
      )}

      <AnimalDeleteDialog
        isOpen={pendingDeleteAnimalId != null}
        animalId={pendingDeleteAnimalId}
        animal={pendingDeleteAnimal}
        days={days}
        onConfirm={confirmDeleteAnimal}
        onCancel={() => setPendingDeleteAnimalId(null)}
      />

      <AnimalProfileDialog
        isOpen={pendingProfileAnimalId != null}
        animal={pendingProfileAnimal}
        dayCount={pendingProfileAnimal ? getAnimalDayIds(pendingProfileAnimal).length : 0}
        onSave={(subject) => actions.updateAnimal(pendingProfileAnimalId, { subject })}
        onClose={() => setPendingProfileAnimalId(null)}
      />
    </main>
  );
}

AnimalWorkspace.propTypes = {};

export default AnimalWorkspace;
