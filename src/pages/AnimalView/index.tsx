/**
 * AnimalView — the tabbed animal shell (Phase 1 — tabbed-workspace-ia).
 *
 * Renders one animal at `#/animal/:id/:tab`: an animal header, a grouped LEFT section-nav (a
 * navigation landmark with `aria-current` links — NOT a WAI-ARIA tablist, since each tab is its
 * own route), and the active tab's panel. Phase 1 wires only the `days` tab (the shared
 * {@link RecordingDaysTab}); the setup tabs render a placeholder pointing at the still-live
 * Animal Editor until Phase 3 extracts them here.
 *
 * Landmark contract: exactly one `#main-content` (the legacy Workspace renders a *different*
 * route, so they never co-exist). Focus moves to the panel on tab change because AppLayout's
 * route-change focus fires only on `view` change, not `:tab` (Task 1.1b).
 */

import { useEffect, useRef, useState, useMemo, type MouseEvent as ReactMouseEvent, type ComponentProps } from 'react';
import { useStoreContext } from '../../state/StoreContext';
import type { Animal } from '../../state/workspaceTypes';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { getAnimalOptoCompleteness, OPTO_COMPLETENESS } from '../../domain/sectionStatus';
import { optoFieldsPresence } from '../../domain/optoCompleteness';
import { buildAnimalViewModel } from '../../viewModels/animalViewModel';
import type { AnimalConfigCardViewModel, AnimalBlastRadiusViewModel } from '../../viewModels/animalViewModel';
import { useReconfigContext } from '../../hooks/useReconfigContext';
import { ConfirmDialog } from '../../components/Modal';
import OverflowMenu from '../../components/OverflowMenu';
import AnimalDeleteDialog from '../../components/AnimalDeleteDialog';
import AnimalProfileDialog from '../../components/AnimalProfileDialog';
import { RecordingDaysTab } from '../AnimalWorkspace/RecordingDaysTab';
import SaveIndicator from '../DayEditor/SaveIndicator';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import ReconfigurationContextBanner from '../../components/ReconfigurationContextBanner';
import ElectrodeGroupsContainer from '../AnimalEditor/wiring/ElectrodeGroupsContainer';
import RecordingSystemContainer from '../AnimalEditor/wiring/RecordingSystemContainer';
import CamerasContainer from '../AnimalEditor/wiring/CamerasContainer';
import TaskTypesContainer from '../AnimalEditor/wiring/TaskTypesContainer';
import OptogeneticsContainer from '../AnimalEditor/wiring/OptogeneticsContainer';
import { useAnimalFieldUpdate } from '../AnimalEditor/wiring/useAnimalFieldUpdate';
import BlastRadiusChip from '../../components/ui/BlastRadiusChip';
import { useUndoToast } from '../../components/ui/UndoToast';
import ConfigVersionContext from './ConfigVersionContext';
import AnimalScopeChips from './AnimalScopeChips';
import ConfigurationCard from './ConfigurationCard';
import NewConfigurationModal from './NewConfigurationModal';
import { ValidationSummary } from '../ValidationSummary';
import '../../components/ErrorState.css';
import styles from './AnimalView.module.css';
import navStyles from './SectionNav.module.css';

/**
 * Animal raw-collection fields whose corruption the AnimalView-level banner owns. These three span
 * THREE different setup tabs (cameras / recording-system / config history), so the banner must live
 * ABOVE the panels — a per-tab render would hide a sibling field's corruption (charter decision 1).
 */
const CORRUPTION_BANNER_FIELDS = ['cameras', 'data_acq_device', 'configurationHistory'];

/**
 * The primary schema field each setup tab owns, used as the `data-field-path` anchor a `?field=`
 * repair deep-link scrolls to and highlights (Phase 3a.3). A requested field matches a tab's anchor
 * when, with array indices stripped, it equals or is prefixed by the anchor (so
 * `data_acq_device[0].name` matches `data_acq_device`).
 */
const TAB_FIELD_ANCHOR: Record<string, string> = {
  'electrode-groups': 'electrode_groups',
  'recording-system': 'data_acq_device',
  cameras: 'cameras',
  'task-types': 'taskTypes',
  optogenetics: 'opto_excitation_source',
};

/**
 * Strip array indices so a specific field path can be matched against a coarse section anchor.
 */
const normalizeFieldPath = (value: unknown): string =>
  String(value || '').replace(/\[\d+\]/g, '').replace(/\.\d+/g, '');

/** Decision inputs for {@link shouldInterceptNavDiscard}. */
interface NavDiscardContext {
  /** The :tab the clicked link points at. */
  targetKey: string;
  /** The currently active :tab. */
  currentTab: string;
  /** Whether the active setup editor reports unsaved edits. */
  pendingEdits: boolean;
  /** The click event (modifier keys / mouse button). */
  event: {
    metaKey?: boolean;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    button?: number;
  };
}

/**
 * Pure decision for the section-nav unsaved-edit guard (charter decision 2): should a nav click be
 * INTERCEPTED (preventDefault → discard-confirm dialog) instead of navigating?
 *
 * Intercept ONLY when ALL hold: there are pending edits, the link targets a DIFFERENT tab, and it's
 * a plain primary click (no modifier / non-primary button — those open a SEPARATE document and
 * never discard the edit in THIS one, so they fall through). Otherwise fall through to the link's
 * normal hash navigation.
 *
 * Extracted as a pure, exported function because the live browser path is currently UNREACHABLE —
 * every shipped setup editor that sets `pendingEdits` is a focus-trapping modal whose overlay eats
 * the nav click first (see the LATENT SAFETY NET note in AnimalView). Testing this decision directly
 * is the honest way to pin the guard's behavior. See AnimalView.navDiscardGuard.test.jsx.
 */
export function shouldInterceptNavDiscard({ targetKey, currentTab, pendingEdits, event }: NavDiscardContext): boolean {
  if (!pendingEdits || targetKey === currentTab) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
    return false;
  }
  return true;
}

/** Panel context for {@link renderPanel}. */
interface RenderPanelContext {
  /** The active tab (route `:tab` segment). */
  tab: string;
  /** The animal whose section to render. */
  animalId: string;
  /** The resolved animal record (for config-version legibility / status). */
  animal: Animal;
  /** Pending-edit reporter the setup containers call so the shell can guard a section-nav switch. */
  onPendingEditsChange: (pending: boolean) => void;
  /** Field-update callback the `{ animal, onFieldUpdate }` containers persist through. */
  onFieldUpdate: (field: string, value: unknown) => void;
  /** The current-configuration card data, rendered above the Electrode Groups editor. */
  configCard: AnimalConfigCardViewModel;
  /** The blast radius (chip day count) for the re-export-forcing setup tabs (cameras / opto). */
  blastRadius: AnimalBlastRadiusViewModel;
  /** Called after an optogenetics write commits, so the host can surface the re-export consequence. */
  onOptoAfterUpdate: () => void;
  /** Open the new-configuration (re-implant) modal — wired to the ConfigurationCard's action. */
  onNewConfiguration: () => void;
}

/** The four export-gated optogenetics fields, for the "Opto configured · N of N" meter. */
const OPTO_TOTAL_FIELDS = 4;

/**
 * Render the active tab's panel content. The `days` tab hosts the shared RecordingDaysTab; the
 * setup tabs host their extracted containers (Phase 3-2/3-3); only `export` still shows the
 * Phase-1 placeholder until its sub-phase (3-5) lands.
 */
function renderPanel({ tab, animalId, animal, onPendingEditsChange, onFieldUpdate, configCard, blastRadius, onOptoAfterUpdate, onNewConfiguration }: RenderPanelContext) {
  switch (tab) {
    case 'days':
      return <RecordingDaysTab animalId={animalId} />;
    case 'electrode-groups':
      return (
        <>
          <ConfigurationCard card={configCard} onNewConfiguration={onNewConfiguration} />
          <ConfigVersionContext animal={animal} />
          <ElectrodeGroupsContainer animalId={animalId} onPendingEditsChange={onPendingEditsChange} />
        </>
      );
    case 'export':
      // The per-animal Validation & Export surface — a scoped slice of the workspace Validation
      // Summary (readiness + repairs + export for THIS animal). Renders without its own <main>.
      return <ValidationSummary animalKey={animalId} />;
    case 'recording-system':
      return <RecordingSystemContainer animal={animal} onFieldUpdate={onFieldUpdate} />;
    case 'cameras':
      return (
        <>
          {/* Cameras are animal-static — an edit forces affected days to re-export. */}
          <BlastRadiusChip dayCount={blastRadius.totalDays} />
          <CamerasContainer
            animal={animal}
            onFieldUpdate={onFieldUpdate}
            onPendingEditsChange={onPendingEditsChange}
          />
        </>
      );
    case 'task-types':
      return (
        <TaskTypesContainer
          animal={animal}
          onFieldUpdate={onFieldUpdate}
          onPendingEditsChange={onPendingEditsChange}
        />
      );
    case 'optogenetics': {
      // Optogenetics is animal-static — an edit forces affected days to re-export. When configured,
      // a completeness meter ("Opto configured · N of N") replaces the never-used chip.
      const optoPresent = optoFieldsPresence(
        (animal as { optogenetics?: unknown }).optogenetics as Parameters<typeof optoFieldsPresence>[0]
      );
      return (
        <>
          <BlastRadiusChip dayCount={blastRadius.totalDays} />
          {getAnimalOptoCompleteness(animal) === OPTO_COMPLETENESS.NONE ? (
            // A NEVER-configured opto tab is a VALID state, not an error — a neutral chip says so, so
            // the empty section doesn't read as missing setup (charter tab→content map). Keyed to the
            // NONE state specifically (not the setup-status TODO, which also covers PARTIAL): a
            // partially-configured animal IS using opto, so "Not used" would be wrong there — the
            // meter below shows its partial completeness instead.
            <p className={styles.statusChip} data-testid="opto-status-chip">
              Not used — no stimulation
            </p>
          ) : (
            <p className={styles.optoMeter} data-testid="opto-meter">
              Opto configured · {optoPresent.count} of {OPTO_TOTAL_FIELDS}
            </p>
          )}
          <OptogeneticsContainer animalId={animalId} onAfterUpdate={onOptoAfterUpdate} />
        </>
      );
    }
    default:
      return (
        <div className={styles.placeholder}>
          {/* Only reached for a tab outside the known set (the router resolves those to `days`), so
              the heading falls back to the generic label. */}
          <h2>Section</h2>
          <p>
            This section moves here in a later phase. For now, configure it in{' '}
            <a href={`#/animal/${animalId}/days`}>Animal Setup</a>.
          </p>
        </div>
      );
  }
}

/** Props for {@link AnimalView}. */
interface AnimalViewProps {
  /** The animal whose view to render. */
  animalId: string;
  /** The active tab (route `:tab` segment). */
  tab: string;
}

/**
 * AnimalView component.
 */
export function AnimalView({ animalId, tab }: AnimalViewProps) {
  const { model, actions, persistence } = useStoreContext();
  const { animals = {} } = model.workspace;
  const animal = animalId ? animals[animalId] : null;

  // Whether the header ⋮'s type-to-confirm animal-delete dialog is open. Deleting the viewed animal
  // leaves the route pointing at a now-missing id, which the not-found guard below handles (no
  // stranding). The shared AnimalDeleteDialog owns the cascade copy + the typed-id gate.
  const [animalDeleteOpen, setAnimalDeleteOpen] = useState(false);
  // Whether the header ⋮'s "Edit profile…" dialog is open. The animal-wide subject facts editor
  // moved off the header band into this on-demand dialog (it cluttered every tab).
  const [profileOpen, setProfileOpen] = useState(false);
  // Whether the ConfigurationCard's "New configuration…" (re-implant) modal is open.
  const [newConfigOpen, setNewConfigOpen] = useState(false);

  // Shared store-bound field-update + repair callbacks for the `{ animal, onFieldUpdate }` setup
  // containers (recording-system / cameras / dio), the corruption banner, and the profile save — the
  // wiring extracted from the removed legacy stepper (Phase 5), now the single owner of this logic.
  const { handleFieldUpdate, handleRepair } = useAnimalFieldUpdate(animalId);

  // Transient reconfiguration context from the hash (`?context=reconfigure&version=…`), parsed by the
  // shared useReconfigContext hook — the single source for the header banner (no per-surface forks).
  const routeContext = useReconfigContext();

  // The page view-model: the animal header facts, the grouped section-nav (each tab's status ring +
  // count token + link), the resolved active tab, and the active panel's heading + scope — all
  // decided in the builder so the nav never re-derives "blocks export / not set up" or the counts.
  // Built unconditionally (the builder tolerates an absent animal) so the hook order is stable; the
  // not-found guard below short-circuits before any of it is rendered.
  const vm = useMemo(
    () => buildAnimalViewModel(model.workspace, animalId, tab),
    [model.workspace, animalId, tab]
  );

  // Post-edit consequence toast (Phase 2): committing an animal-static edit (Identity / Cameras /
  // Optogenetics) makes already-exported days stale, so surface "N already-exported days now need
  // re-export". Reuses the Phase-0 toast host with NO Undo (it's a notice, not a reversible action).
  const consequenceToast = useUndoToast();
  const { exportedDays } = vm.blastRadius;
  const noteEditConsequence = () => {
    if (exportedDays <= 0) return;
    const noun = exportedDays === 1 ? 'day' : 'days';
    const verb = exportedDays === 1 ? 'needs' : 'need';
    consequenceToast.show(`Saved · ${exportedDays} already-exported ${noun} now ${verb} re-export`);
  };

  // The setup containers' field-update path. A write to an animal-static, re-export-forcing section
  // (cameras here; opto routes through its own onAfterUpdate; identity through the profile save) also
  // surfaces the consequence. Recording-system writes (`data_acq_device`) are NOT re-export-forcing,
  // so they fall through without a consequence.
  const handleStaticFieldUpdate = (field: string, value: unknown) => {
    handleFieldUpdate(field, value);
    if (field === 'cameras') noteEditConsequence();
  };

  const panelRef = useRef<HTMLElement>(null);
  const isFirstRender = useRef(true);

  // Unsaved-edit guard (charter decision 2). A setup container reports `true` while its
  // editor/modal is open; the shell owns the section-nav, so it intercepts a link to ANOTHER tab
  // and asks the user to confirm discarding before allowing the route to change. `setPendingEdits`
  // is a stable useState setter, so passing it as the container's `onPendingEditsChange` doesn't
  // thrash the container's reporting effect.
  //
  // LATENT SAFETY NET: every CURRENT setup editor that reports `pendingEdits`
  // (ElectrodeGroupsContainer, CamerasContainer) is a
  // focus-trapping shared `Modal` whose overlay intercepts the section-nav click before
  // `handleNavClick` ever runs — so in today's shipped UI this discard-confirm is UNREACHABLE.
  // It is correct, intentional code kept for a FUTURE inline (non-modal) setup editor that reports
  // `pendingEdits`: that editor would leave the nav clickable, and only then does this guard fire.
  // Pinned by AnimalView.navDiscardGuard.test.jsx (the browser path is unreachable, so it tests the
  // guard's decision directly). DO NOT remove because "nothing triggers it" — it is the net.
  const [pendingEdits, setPendingEdits] = useState(false);
  const [pendingNavTab, setPendingNavTab] = useState<string | null>(null);

  // Task 1.1b: AppLayout focuses #main-content on `view` change (legacy -> animal-view), but a
  // `:tab` change keeps the same view, so AppLayout won't fire. Move focus to the panel on tab
  // change so keyboard/SR users land on the new content. Skip the initial render (AppLayout owns
  // mount focus) to avoid fighting it.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    panelRef.current?.focus();
  }, [tab, animalId]);

  // Phase 3a.3: a repair deep-link (`?field=…`) lands on the owning tab — orient the user by
  // scrolling to and briefly highlighting the section that field belongs to, matching the Day
  // Editor's repair-target highlight. With no matching section anchor it degrades silently (the
  // panel-focus effect above already lands them on the tab content). The panel ref scopes the
  // query so it never matches an anchor outside this animal's panel.
  useEffect(() => {
    const field = routeContext.field;
    if (!field) return undefined;
    let highlighted: HTMLElement | null = null;
    let removeTimer: ReturnType<typeof setTimeout> | null = null;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const requested = normalizeFieldPath(field);
      const match = Array.from(panel.querySelectorAll<HTMLElement>('[data-field-path]')).find((el) => {
        const anchor = normalizeFieldPath(el.getAttribute('data-field-path'));
        return anchor !== '' && (requested === anchor || requested.startsWith(anchor));
      });
      if (!match) return;
      if (typeof match.scrollIntoView === 'function') match.scrollIntoView({ block: 'nearest' });
      match.classList.add('repair-target-highlight');
      highlighted = match;
      // Move focus to where the fix happens, not the panel wrapper. The section anchor is a
      // structural <div>, so focus the first focusable control within it (matching the Day
      // Editor, which focuses the owning control). A setup table with no inline input still
      // exposes an "Edit"/action button, so this lands keyboard/SR users inside the section.
      // If the section somehow has no focusable control, keep the existing panel focus.
      const focusTarget = match.querySelector<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
          'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusTarget && typeof focusTarget.focus === 'function') focusTarget.focus();
      // Transient cue: drop it so it doesn't read as a persistent state.
      removeTimer = setTimeout(() => match.classList.remove('repair-target-highlight'), 2000);
    });
    return () => {
      cancelAnimationFrame(raf);
      if (removeTimer) clearTimeout(removeTimer);
      if (highlighted) highlighted.classList.remove('repair-target-highlight');
    };
  }, [routeContext.field, tab, animalId]);

  // Canonicalize the URL: parseHashRoute resolves a bare `#/animal/:id` or an unknown tab to
  // `days`, so REPLACE the address bar to the canonical `#/animal/:id/:tab` to match what's
  // rendered (a tidy, bookmarkable URL). replaceState only — the view already shows the resolved
  // tab, so no `hashchange` is dispatched and there's no redirect loop (every canonical tab is in
  // ANIMAL_VIEW_TABS, so a canonical write is self-stable). Pressing Back onto a non-canonical
  // entry rewrites THAT entry too — intended: a `banana`/no-tab URL should not be revisitable.
  useEffect(() => {
    if (!animalId) return;
    const literalPath = window.location.hash.slice(1).split('?')[0];
    const canonical = `/animal/${animalId}/${tab}`;
    if (literalPath !== canonical && literalPath.startsWith(`/animal/${animalId}`)) {
      window.history.replaceState(null, '', `#${canonical}`);
    }
  }, [animalId, tab]);

  if (!animal) {
    // Task 1.5: the store hydrates SYNCHRONOUSLY (useWorkspace's useState initializer reads
    // localStorage before first render — see useWorkspace.js), so there is no async cold-load
    // gap: a missing animal genuinely doesn't exist (bad deep-link, or the viewed animal was
    // just deleted). Show a non-stranding "not found" with a way out for ALL of those — never a
    // perpetual "Loading…" (an emptied-after-delete workspace would otherwise hang there).
    return (
      <main
        id="main-content"
        tabIndex={-1}
        role="main"
        aria-labelledby="animal-view-heading"
        className="error-state"
      >
        <h1 id="animal-view-heading">Animal not found</h1>
        <p>No animal “{animalId}” in this workspace.</p>
        {/* Match the Day Editor's not-found escape: a prominent, keyboard-reachable return action
            (the shared `error-state-action` styling) rather than a link buried in a sentence. */}
        <a href="#/workspace" className="error-state-action">
          ← Back to Workspace
        </a>
      </main>
    );
  }

  const facts = [vm.header.speciesLabel, vm.header.sexLabel].filter(Boolean).join(' · ');

  /**
   * Intercept a section-nav activation when the active setup container has pending edits, so a
   * switch to ANOTHER tab is confirmed before the route changes (charter decision 2). Same-tab
   * clicks and the no-pending-edits case fall through to the link's normal hash navigation. The
   * intercept DECISION is the pure {@link shouldInterceptNavDiscard} (unit-pinned), since the real
   * browser path is currently unreachable — see the LATENT SAFETY NET note on `pendingEdits`.
   */
  const handleNavClick = (event: ReactMouseEvent<HTMLAnchorElement>, targetKey: string) => {
    if (!shouldInterceptNavDiscard({ targetKey, currentTab: tab, pendingEdits, event })) return;
    event.preventDefault();
    setPendingNavTab(targetKey);
  };

  /** Confirm the discard: drop the edit, clear the guard, and navigate to the queued tab. */
  const confirmDiscardAndNavigate = () => {
    const target = pendingNavTab;
    setPendingNavTab(null);
    setPendingEdits(false);
    if (target) window.location.hash = `#/animal/${animalId}/${target}`;
  };

  return (
    <main id="main-content" tabIndex={-1} role="main" aria-labelledby="animal-view-heading">
      <header className={styles.header} data-testid="animal-view-header">
        <h1 id="animal-view-heading">{animal.id}</h1>
        <span className={styles.idbadge}>animal ID</span>
        {facts && <span className={styles.facts}>{facts}</span>}
        {/* Save-confidence cue — the SAME shared SaveIndicator the Day Editor shows, reading the
            SAME workspace persistence state (`useStoreContext().persistence`), so an animal-level
            setup edit gets the same "Saving… / Saved" feedback day edits already get. It is NOT an
            optimistic local timestamp; it reflects real autosave outcomes (display-only — no export
            bytes, no validation rule). Lives in the header band so it shows on every tab. */}
        <div className={styles.headerSave}>
          <SaveIndicator persistence={persistence} />
        </div>
        {/* Per-animal lifecycle ⋮ — the SAME reusable menu + type-to-confirm dialog as the picker
            card, so animal delete reads one truth from either surface (Task 4.1). */}
        <div className={styles.headerActions}>
          <OverflowMenu
            label={`Actions for ${animal.id}`}
            items={[
              {
                key: 'profile',
                label: 'Edit profile…',
                onSelect: () => setProfileOpen(true),
              },
              {
                key: 'delete',
                label: 'Delete animal…',
                onSelect: () => setAnimalDeleteOpen(true),
              },
            ]}
          />
        </div>
      </header>

      {/* The read-only animal-static scope (identity · probes · config · team · opto), shared by
          every recording day. Surfaces the "what's fixed for this animal" context on every tab. */}
      <AnimalScopeChips summary={vm.summary} />

      {/* Reconfiguration context belongs in the header band (NOT a tab — Phase 3-4): visible
          regardless of which setup tab is open. The animal-wide subject-facts EDITOR moved off the
          band into the header ⋮'s "Edit profile…" dialog (it cluttered every tab); the read-only
          facts stay in the header h1/badge above. */}
      <ReconfigurationContextBanner
        animal={animal}
        routeContext={routeContext}
        days={model.workspace.days}
      />

      {/* Charter decision 1: the 3-field corruption banner lives ABOVE the tab panels (not per-tab)
          so corruption in cameras / data_acq_device / configurationHistory — now split across three
          setup tabs — is visible from every tab, never hidden behind a sibling field's closed tab.
          Self-hides when clean. */}
      <RawCorruptionBanner
        animal={animal}
        fields={CORRUPTION_BANNER_FIELDS}
        onRepair={handleRepair}
      />

      <div className={styles.body}>
        <nav className={navStyles.nav} aria-label="Animal sections">
          {vm.groups.map((group) => (
            <div className={navStyles.group} key={group.label}>
              <div className={navStyles.groupLabel}>{group.label}</div>
              {group.sections.map((section) => {
                const active = tab === section.key;
                // The builder mapped the section status (blocking ● outranks never-configured ○):
                // 'error' → blocks export, 'todo' → not set up. The accessible name (summary) carries
                // that meaning; a 'ready' section announces nothing beyond its label.
                const isBlocking = section.status === 'error';
                const isTodo = section.status === 'todo';
                const ariaLabel = isBlocking || isTodo ? section.summary : undefined;
                return (
                  <a
                    key={section.key}
                    href={section.action?.href}
                    className={`${navStyles.item} ${active ? navStyles.isActive : ''}`}
                    aria-current={active ? 'page' : undefined}
                    aria-label={ariaLabel}
                    onClick={(event) => handleNavClick(event, section.key)}
                  >
                    <span className={navStyles.itemName}>{section.label}</span>
                    {/* Decision 10 trailing affordance: name · [● blocking] · count · › — all
                        aria-hidden visual "information scent" (the link's accessible name still
                        carries the blocking/todo meaning via aria-label, so SR users are unaffected
                        and name-based queries stay stable). A blocking section keeps its red ● AND
                        shows its count (e.g. Cameras ● 2); a never-configured section shows the
                        neutral hollow-○ ring IN the count slot (no bare "0"). */}
                    {isBlocking && (
                      <span className={navStyles.blocking} aria-hidden="true">●</span>
                    )}
                    {section.showCount ? (
                      <span className={navStyles.count} aria-hidden="true">
                        {section.countLabel}
                      </span>
                    ) : (
                      <span className={navStyles.todo} aria-hidden="true">○</span>
                    )}
                    <span className={navStyles.chev} aria-hidden="true">›</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <section
          className={styles.panel}
          aria-label={vm.activePanel.label}
          tabIndex={-1}
          ref={panelRef}
        >
          {vm.activePanel.scope && (
            <p className={styles.panelScope} data-testid={`panel-scope-${tab}`}>
              {vm.activePanel.scope}
            </p>
          )}
          {/* `data-field-path` marks the section a `?field=` repair deep-link highlights (3a.3). */}
          <div data-field-path={TAB_FIELD_ANCHOR[tab]}>
            {renderPanel({
              tab,
              animalId,
              animal,
              onPendingEditsChange: setPendingEdits,
              onFieldUpdate: handleStaticFieldUpdate,
              configCard: vm.configCard,
              blastRadius: vm.blastRadius,
              onOptoAfterUpdate: noteEditConsequence,
              onNewConfiguration: () => setNewConfigOpen(true),
            })}
          </div>
        </section>
      </div>

      <ConfirmDialog
        isOpen={pendingNavTab != null}
        title="Discard unsaved changes?"
        message="You have unsaved changes in this editor. Leaving this section will discard them."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmDiscardAndNavigate}
        onCancel={() => setPendingNavTab(null)}
      />

      <AnimalProfileDialog
        isOpen={profileOpen}
        animal={animal}
        dayCount={getAnimalDayIds(animal).length}
        onSave={(subject) => {
          // Identity is animal-static — the change applies to every day, so surface the re-export
          // consequence for already-exported days.
          handleFieldUpdate('subject', subject);
          noteEditConsequence();
        }}
        onClose={() => setProfileOpen(false)}
      />

      <AnimalDeleteDialog
        isOpen={animalDeleteOpen}
        animalId={animalId}
        animal={animal}
        days={model.workspace.days}
        onConfirm={() => {
          setAnimalDeleteOpen(false);
          actions.deleteAnimal(animalId);
          // We just deleted the animal we're viewing, so the route now points at a gone animal.
          // Navigate to the picker instead of letting this view fall to its "Animal not found"
          // state — that reads like a 404/error for what was a deliberate delete.
          window.location.hash = '#/workspace';
        }}
        onCancel={() => setAnimalDeleteOpen(false)}
      />

      <NewConfigurationModal
        isOpen={newConfigOpen}
        onClose={() => setNewConfigOpen(false)}
        animal={animal as Animal}
        animalKey={animalId}
        days={model.workspace.days}
        actions={actions as unknown as ComponentProps<typeof NewConfigurationModal>['actions']}
      />

      {/* The post-edit re-export consequence notice (mounted once; null until an animal-static save). */}
      {consequenceToast.node}
    </main>
  );
}

export default AnimalView;
