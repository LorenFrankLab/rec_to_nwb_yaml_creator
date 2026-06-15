/**
 * Animal Workspace View — the animal PICKER (Phase 1 — tabbed-workspace-ia).
 *
 * After the tab-shell conversion the Workspace is a pure picker + empty state: each animal card
 * is a LINK to `#/animal/:id/days`, where the tabbed {@link AnimalView} owns that animal's days
 * and setup. The per-animal recording-days pane lives in {@link RecordingDaysTab} (hosted by
 * AnimalView). Selecting an animal navigates to the route rather than rendering inline, so the
 * pane has exactly one home.
 *
 * @see src/state/workspaceTypes.js for the workspace data model (typedefs)
 */

import { useEffect, useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { buildAnimalWorkspaceViewModel } from '../../viewModels/animalWorkspaceViewModel';
import { commandHandlers } from '../../viewModels/commands';
import type { CommandActions } from '../../viewModels/commands';
import { buildAnimalFromForm, getDefaultExperimenters } from '../../domain/animalCreation';
import type { AnimalCreationFormData } from '../../domain/animalCreation';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import OverflowMenu from '../../components/OverflowMenu';
import AnimalDeleteDialog from '../../components/AnimalDeleteDialog';
import AnimalProfileDialog from '../../components/AnimalProfileDialog';
import AnimalCreationForm from '../Home/AnimalCreationForm';
import ImportYamlDialog from './ImportYamlDialog';
import styles from './AnimalWorkspace.module.css';

/**
 * AnimalWorkspace Component
 *
 * The animal picker. Supports the post-create-day handshake `#/workspace?animal=<id>`, which now
 * navigates to that animal's days route (the animal experience lives at `#/animal/:id/:tab`).
 */
export function AnimalWorkspace() {
  const { model, actions } = useStoreContext();

  // Default the required sections so a workspace that somehow reaches here without them
  // renders its empty state instead of crashing on Object.keys(undefined). The raw maps stay for
  // the interaction handlers (create/delete/profile dialogs); the picker's display comes from the VM.
  const { animals = {}, days = {} } = model.workspace;

  // createAnimal routes through the descriptor command layer (the VM's `primaryAction` command).
  // deleteAnimal / profile edits stay on the store actions — they are not VM-emitted descriptors.
  const run = useMemo(
    () => commandHandlers({ actions: actions as unknown as CommandActions }),
    [actions]
  );

  // The picker view-model: the animal cards (id + present-day count + link) and the empty state.
  const vm = useMemo(() => buildAnimalWorkspaceViewModel(model.workspace), [model.workspace]);
  const hasAnimals = vm.animals.length > 0;

  // The animal id whose delete dialog is open (null when closed). Deleting is the highest-blast-
  // radius action, so it routes through the shared type-to-confirm AnimalDeleteDialog rather than a
  // menu-adjacent button. A single dialog instance serves whichever card's ⋮ opened it.
  const [pendingDeleteAnimalId, setPendingDeleteAnimalId] = useState<string | null>(null);
  const pendingDeleteAnimal = pendingDeleteAnimalId ? animals[pendingDeleteAnimalId] : null;
  // The animal whose "Edit profile…" dialog is open (from a card ⋮) — same dialog as the header /
  // switcher, so subject facts are editable from wherever an animal is listed.
  const [pendingProfileAnimalId, setPendingProfileAnimalId] = useState<string | null>(null);
  const pendingProfileAnimal = pendingProfileAnimalId ? animals[pendingProfileAnimalId] : null;

  // Whether the inline create-animal panel is open (Task 4.2). Create lives IN the workspace — an
  // inline panel on the picker, not a route to a separate `#/home` screen — so first-animal creation
  // uses the same pattern as everything else (this unblocks Phase 5's Home/stepper removal).
  const [showCreate, setShowCreate] = useState(false);

  // Whether the YAML-import dialog is open. Import lives in the workspace beside create — it brings
  // existing {mmddYYYY}_{subject}_metadata.yml files in as animals + days through the reconcile
  // core, and (unlike create) never writes until the user confirms its preview.
  const [showImport, setShowImport] = useState(false);

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
   */
  const handleCreate = (formData: AnimalCreationFormData) => {
    const { animalId, subject, metadata } = buildAnimalFromForm(formData);
    // Defense-in-depth (same as Home): the store throws on a duplicate id from inside a React
    // updater, which can't be caught here — so guard before navigating, or a regressed form check
    // would silently navigate "into the new animal" while the create failed. The form already
    // enforces uniqueness; on collision we don't create or navigate.
    if (animals[animalId]) return;
    run.createAnimal({ id: 'createAnimal' }, { animalId, subject, metadata });
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
    // Mount-only handshake: intentionally runs once. Re-running when `animals` changes would
    // re-process the transient ?animal / ?create params and re-fire the redirect / open the panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      {showCreate ? (
        /* Inline create-animal panel (Task 4.2): the existing AnimalCreationForm, hosted ON the
           picker. On success we navigate to the new animal's days route; cancel just closes it. */
        <section className={styles.createAnimalPanel} aria-label="Create animal">
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
          <p className={styles.emptyMessage}>{vm.empty?.message}</p>
          <p>Create your first animal to start managing recording sessions.</p>
          <button
            type="button"
            className={styles.createAnimalLink}
            onClick={() => setShowCreate(true)}
          >
            Create Animal
          </button>
          <button
            type="button"
            className={styles.importYamlLink}
            onClick={() => setShowImport(true)}
          >
            Import YAML…
          </button>
        </div>
      ) : (
        /* Animal picker: each card links to the animal's tabbed view. */
        <nav className={styles.animalList} aria-label="Animal list">
          <div className={styles.animalListHeader}>
            <h2>Animals</h2>
            <div className={styles.animalListActions}>
              <button
                type="button"
                className={styles.btnImportYaml}
                aria-label="Import YAML files"
                onClick={() => setShowImport(true)}
              >
                Import YAML…
              </button>
              <button
                type="button"
                className={styles.btnCreateAnimal}
                aria-label="Create new animal"
                onClick={() => setShowCreate(true)}
              >
                + New Animal
              </button>
            </div>
          </div>
          {vm.animals.map(({ id: animalId, dayCount, href }) => (
            <div key={animalId} className={styles.animalCard}>
              {/* The card link and the ⋮ menu are SIBLINGS: a menu button can't be nested in the
                  navigation <a> (interactive-in-interactive), and keeping them apart means the
                  destructive Delete can't be hit while opening the animal. */}
              <a className={styles.animalCardLink} href={href}>
                <div className={styles.animalName}>{animalId}</div>
                <div className={styles.animalDayCount}>
                  {dayCount} {dayCount === 1 ? 'day' : 'days'}
                </div>
              </a>
              <OverflowMenu
                label={`Actions for ${animalId}`}
                buttonClassName={styles.animalCardMenu}
                items={[
                  {
                    key: 'open',
                    label: 'Open',
                    onSelect: () => {
                      window.location.hash = href;
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
          ))}
        </nav>
      )}

      <AnimalDeleteDialog
        isOpen={pendingDeleteAnimalId != null}
        animalId={pendingDeleteAnimalId ?? undefined}
        animal={pendingDeleteAnimal ?? undefined}
        days={days}
        onConfirm={confirmDeleteAnimal}
        onCancel={() => setPendingDeleteAnimalId(null)}
      />

      {showImport && <ImportYamlDialog onClose={() => setShowImport(false)} />}

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

export default AnimalWorkspace;
