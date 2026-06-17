/**
 * Animals home — the top-level animal picker (was the bare card list).
 *
 * Renders a disambiguating table: one row per animal with genotype, species, day count, last
 * recording, an opto tag, and a rolled-up day status — each name a real `<a>` to `#/animal/:id/days`
 * (the tabbed {@link AnimalView} owns that animal's days + setup). A client-side search +
 * genotype/status filters narrow the small corpus; the zero-animals state is an onboarding card.
 * (The load/recovery notice is surfaced globally by the app shell, not here.) Create / import /
 * delete / edit-profile keep their existing handlers and dialogs.
 *
 * @see src/state/workspaceTypes.js for the workspace data model (typedefs)
 */

import { useEffect, useMemo, useState } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import { buildAnimalWorkspaceViewModel } from '../../viewModels/animalWorkspaceViewModel';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import StatusPill from '../../components/ui/StatusPill';
import OverflowMenu from '../../components/OverflowMenu';
import AnimalDeleteDialog from '../../components/AnimalDeleteDialog';
import AnimalProfileDialog from '../../components/AnimalProfileDialog';
import styles from './AnimalWorkspace.module.css';

/** Status-filter options; the value (other than 'all') is a status-rollup variant. */
const STATUS_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'all', label: 'All statuses' },
  { value: 'needs_fixing', label: 'Needs review' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'exported', label: 'Exported' },
];

/**
 * AnimalWorkspace — the Animals home. Supports the post-create-day handshake
 * `#/workspace?animal=<id>`, which navigates to that animal's days route. The load/recovery notice
 * is surfaced globally by AppLayout (not here), so a bad load is announced wherever the user lands.
 */
export function AnimalWorkspace() {
  const { model, actions } = useStoreContext();

  // Default the required sections so a workspace that somehow reaches here without them
  // renders its empty state instead of crashing on Object.keys(undefined). The raw maps stay for
  // the interaction handlers (create/delete/profile dialogs); the table's display comes from the VM.
  const { animals = {}, days = {} } = model.workspace;

  // The home view-model: one row per animal (identity, day metadata, status rollup) and the empty state.
  const vm = useMemo(() => buildAnimalWorkspaceViewModel(model.workspace), [model.workspace]);
  const hasAnimals = vm.animals.length > 0;

  // Client-side narrowing of the small corpus (an animal lives ~1–2 months). No store changes.
  const [search, setSearch] = useState('');
  const [genotypeFilter, setGenotypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const genotypeOptions = useMemo(
    () => Array.from(new Set(vm.animals.map((a) => a.genotype).filter(Boolean))).sort(),
    [vm.animals]
  );

  const filteredAnimals = useMemo(() => {
    const query = search.trim().toLowerCase();
    return vm.animals.filter((a) => {
      const matchesSearch =
        !query || a.id.toLowerCase().includes(query) || a.genotype.toLowerCase().includes(query);
      const matchesGenotype = genotypeFilter === 'all' || a.genotype === genotypeFilter;
      const matchesStatus = statusFilter === 'all' || a.statusRollup.variant === statusFilter;
      return matchesSearch && matchesGenotype && matchesStatus;
    });
  }, [vm.animals, search, genotypeFilter, statusFilter]);

  // The animal id whose delete dialog is open (null when closed). Deleting is the highest-blast-
  // radius action, so it routes through the shared type-to-confirm AnimalDeleteDialog rather than a
  // menu-adjacent button. A single dialog instance serves whichever row's ⋮ opened it.
  const [pendingDeleteAnimalId, setPendingDeleteAnimalId] = useState<string | null>(null);
  const pendingDeleteAnimal = pendingDeleteAnimalId ? animals[pendingDeleteAnimalId] : null;
  // The animal whose "Edit profile…" dialog is open (from a row ⋮) — same dialog as the header /
  // switcher, so subject facts are editable from wherever an animal is listed.
  const [pendingProfileAnimalId, setPendingProfileAnimalId] = useState<string | null>(null);
  const pendingProfileAnimal = pendingProfileAnimalId ? animals[pendingProfileAnimalId] : null;

  // Create-from-scratch is the guided wizard at `#/home` (epoch-editor Phase 6) — the "+ New animal"
  // entry points navigate there rather than opening an inline panel here.
  const goToCreate = () => {
    window.location.hash = '#/home';
  };

  // Import is the full-page Import & Repair screen (epoch-editor Phase 7): it brings an existing
  // {mmddYYYY}_{subject}_metadata.yml file in, flagging anything that won't validate with a
  // suggested fix, and never writes until the user confirms.
  const goToImport = () => {
    window.location.hash = '#/import';
  };

  /** Commit the pending animal deletion through the store's guarded deleteAnimal, then close. */
  const confirmDeleteAnimal = () => {
    const id = pendingDeleteAnimalId;
    setPendingDeleteAnimalId(null);
    if (id) actions.deleteAnimal(id);
  };

  // Handshake: `#/workspace?animal=<id>` (e.g. after creating a day) jumps straight to that
  // animal's days route. An unknown/absent `?animal` is ignored — the home is shown. (A SOLE animal
  // is NOT auto-opened: the home stays reachable so "+ New Animal" is always available; the user
  // opens an animal by clicking its name.)
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1]);
    const animalParam = params.get('animal');
    if (animalParam && animals[animalParam]) {
      // REPLACE (not push) the transient handshake URL so Back doesn't bounce the user back into
      // this redirect and forward again. replaceState doesn't fire `hashchange`, so notify the
      // router (useHashRouter) explicitly.
      window.history.replaceState(null, '', `#/animal/${animalParam}/days`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
    // Mount-only handshake: intentionally runs once. Re-running when `animals` changes would
    // re-process the transient ?animal param and re-fire the redirect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount

  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby="workspace-heading">
      <h1 id="workspace-heading">Animal Workspace</h1>

      {!hasAnimals ? (
        /* Empty state: no animals — the onboarding card with the two primary CTAs. "Create Animal"
           opens the guided create-animal wizard at #/home (epoch-editor Phase 6). */
        <div className="empty-state" role="region" aria-label="Empty workspace">
          <p className={styles.emptyMessage}>{vm.empty?.message ?? 'No animals yet'}</p>
          <p>Create your first animal to start managing recording sessions.</p>
          <button type="button" className={styles.createAnimalLink} onClick={goToCreate}>
            Create Animal
          </button>
          <button type="button" className={styles.importYamlLink} onClick={goToImport}>
            Import YAML…
          </button>
        </div>
      ) : (
        /* Animals table: each name links to the animal's tabbed view. */
        <section className={styles.animalsHome} aria-label="Animals">
          <div className={styles.homeToolbar}>
            <div className={styles.homeFilters}>
              <input
                type="search"
                className={styles.homeSearch}
                aria-label="Search animals"
                placeholder="Search animals…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <label className={styles.homeFilterLabel}>
                <span className={styles.homeFilterLabelText}>Genotype</span>
                <select
                  className={styles.homeFilterSelect}
                  value={genotypeFilter}
                  onChange={(e) => setGenotypeFilter(e.target.value)}
                >
                  <option value="all">All genotypes</option>
                  {genotypeOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.homeFilterLabel}>
                <span className={styles.homeFilterLabelText}>Status</span>
                <select
                  className={styles.homeFilterSelect}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_FILTERS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.animalListActions}>
              <button
                type="button"
                className={styles.btnImportYaml}
                aria-label="Import YAML files"
                onClick={goToImport}
              >
                Import YAML…
              </button>
              <button
                type="button"
                className={styles.btnCreateAnimal}
                aria-label="Create new animal"
                onClick={goToCreate}
              >
                + New Animal
              </button>
            </div>
          </div>

          <div className={styles.tableScroll}>
            <table className={styles.animalsTable}>
            <caption className="visually-hidden">Animals</caption>
            <thead>
              <tr>
                <th scope="col">Animal</th>
                <th scope="col">Genotype</th>
                <th scope="col">Species</th>
                <th scope="col" className={styles.numCol}>
                  Days
                </th>
                <th scope="col">Last recording</th>
                <th scope="col">Status</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAnimals.map((a) => (
                <tr key={a.id}>
                  <td className={styles.nameCell}>
                    <a className={styles.animalNameLink} href={a.href}>
                      {a.id}
                    </a>
                    {a.isOpto && <span className={styles.optoTag}>opto</span>}
                  </td>
                  <td>{a.genotype || '—'}</td>
                  <td className={styles.muted}>{a.species || '—'}</td>
                  <td className={styles.numCol}>{a.dayCount}</td>
                  <td className={styles.muted}>{a.lastRecording ?? '—'}</td>
                  <td>
                    <StatusPill variant={a.statusRollup.variant} label={a.statusRollup.label} />
                  </td>
                  <td className={styles.actionsCell}>
                    <OverflowMenu
                      label={`Actions for ${a.id}`}
                      items={[
                        {
                          key: 'open',
                          label: 'Open',
                          onSelect: () => {
                            window.location.hash = a.href;
                          },
                        },
                        {
                          key: 'edit-profile',
                          label: 'Edit profile…',
                          onSelect: () => setPendingProfileAnimalId(a.id),
                        },
                        {
                          key: 'delete',
                          label: 'Delete animal…',
                          onSelect: () => setPendingDeleteAnimalId(a.id),
                        },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {filteredAnimals.length === 0 && (
            <p className={styles.noMatches} role="status">
              No animals match your search.
            </p>
          )}
        </section>
      )}

      <AnimalDeleteDialog
        isOpen={pendingDeleteAnimalId != null}
        animalId={pendingDeleteAnimalId ?? undefined}
        animal={pendingDeleteAnimal ?? undefined}
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

export default AnimalWorkspace;
