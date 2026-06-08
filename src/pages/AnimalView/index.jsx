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

import React, { useEffect, useRef, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalSubject, getAnimalDayIds } from '../../state/workspaceSelectors';
import { classifyAnimalDays, isPresentRecordStatus } from '../../domain/dayRecovery';
import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  getAnimalSetupCounts,
  SECTION_STATUS,
} from '../../domain/sectionStatus';
import { useReconfigContext } from '../../hooks/useReconfigContext';
import { ConfirmDialog } from '../../components/Modal';
import OverflowMenu from '../../components/OverflowMenu';
import AnimalDeleteDialog from '../../components/AnimalDeleteDialog';
import { RecordingDaysTab } from '../AnimalWorkspace/RecordingDaysTab';
import RawCorruptionBanner from '../../components/RawCorruptionBanner';
import ReconfigurationContextBanner from '../../components/ReconfigurationContextBanner';
import AnimalProfileSection from '../AnimalEditor/AnimalProfileSection';
import ElectrodeGroupsContainer from '../AnimalEditor/wiring/ElectrodeGroupsContainer';
import ChannelMapsContainer from '../AnimalEditor/wiring/ChannelMapsContainer';
import RecordingSystemContainer from '../AnimalEditor/wiring/RecordingSystemContainer';
import CamerasContainer from '../AnimalEditor/wiring/CamerasContainer';
import DioContainer from '../AnimalEditor/wiring/DioContainer';
import OptogeneticsContainer from '../AnimalEditor/wiring/OptogeneticsContainer';
import { useAnimalFieldUpdate } from '../AnimalEditor/wiring/useAnimalFieldUpdate';
import ConfigVersionContext from './ConfigVersionContext';
import { ValidationSummary, buildAnimalRows } from '../ValidationSummary';
import './AnimalView.css';

/**
 * Per-tab scope descriptor shown under the panel heading: the one-line framing of a section's
 * ownership/blast-radius (charter "tab → content map"). Only tabs extracted so far carry an
 * entry; later sub-phases add the rest.
 */
const TAB_SCOPE = {
  'electrode-groups': 'Versioned identity — a change here forks a configuration version.',
  'channel-maps': 'Edit any time — map channels, mark bad channels.',
  // Recording system is honest about its blast radius (Task 3.2): it is animal-level setup with NO
  // per-day version, so editing it affects every day. Deliberately NOT framed as "apply per day".
  'recording-system': 'Shared across ALL days (no per-day version).',
  cameras: 'Catalog — referenced per day.',
  dio: 'Library — opt in per day.',
};

/**
 * Section-nav structure: grouped, in display order. Keys are the route `:tab` segments
 * (see ANIMAL_VIEW_TABS in useHashRouter).
 */
const SECTION_GROUPS = [
  {
    label: 'Day work',
    items: [
      { key: 'days', label: 'Recording Days' },
      { key: 'export', label: 'Validation & Export' },
    ],
  },
  {
    label: 'Animal setup',
    items: [
      { key: 'electrode-groups', label: 'Electrode Groups' },
      { key: 'channel-maps', label: 'Channel Maps' },
      { key: 'recording-system', label: 'Recording System' },
      { key: 'cameras', label: 'Cameras' },
      { key: 'dio', label: 'DIO' },
      { key: 'optogenetics', label: 'Optogenetics' },
    ],
  },
];

/** Map of tab key -> display label, derived from SECTION_GROUPS. */
const TAB_LABEL = Object.fromEntries(
  SECTION_GROUPS.flatMap((g) => g.items).map((i) => [i.key, i.label])
);

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
 *
 * @type {Record<string, string>}
 */
const TAB_FIELD_ANCHOR = {
  'electrode-groups': 'electrode_groups',
  'channel-maps': 'ntrode_electrode_group_channel_map',
  'recording-system': 'data_acq_device',
  cameras: 'cameras',
  dio: 'behavioral_events',
  optogenetics: 'opto_excitation_source',
};

/**
 * Strip array indices so a specific field path can be matched against a coarse section anchor.
 * @param {string} value - A field path or anchor.
 * @returns {string} The path with `[i]` / `.i` index segments removed.
 */
const normalizeFieldPath = (value) => String(value || '').replace(/\[\d+\]/g, '').replace(/\.\d+/g, '');

/**
 * Render the active tab's panel content. The `days` tab hosts the shared RecordingDaysTab; the
 * setup tabs host their extracted containers (Phase 3-2/3-3); only `export` still shows the
 * Phase-1 placeholder until its sub-phase (3-5) lands.
 *
 * @param {object} ctx - Panel context.
 * @param {string} ctx.tab - The active tab (route `:tab` segment).
 * @param {string} ctx.animalId - The animal whose section to render.
 * @param {object} ctx.animal - The resolved animal record (for config-version legibility / status).
 * @param {Function} ctx.onPendingEditsChange - Pending-edit reporter the setup containers call so
 *   the shell can guard a section-nav switch (charter decision 2).
 * @param {Function} ctx.onFieldUpdate - Field-update callback the `{ animal, onFieldUpdate }`
 *   containers (recording-system / cameras / dio) persist through.
 * @returns {React.Element}
 */
function renderPanel({ tab, animalId, animal, onPendingEditsChange, onFieldUpdate }) {
  switch (tab) {
    case 'days':
      return <RecordingDaysTab animalId={animalId} />;
    case 'electrode-groups':
      return (
        <>
          <ConfigVersionContext animal={animal} />
          <ElectrodeGroupsContainer animalId={animalId} onPendingEditsChange={onPendingEditsChange} />
        </>
      );
    case 'channel-maps':
      return <ChannelMapsContainer animalId={animalId} onPendingEditsChange={onPendingEditsChange} />;
    case 'export':
      // The per-animal Validation & Export surface — a scoped slice of the workspace Validation
      // Summary (readiness + repairs + export for THIS animal). Renders without its own <main>.
      return <ValidationSummary animalKey={animalId} />;
    case 'recording-system':
      return <RecordingSystemContainer animal={animal} onFieldUpdate={onFieldUpdate} />;
    case 'cameras':
      return (
        <CamerasContainer
          animal={animal}
          onFieldUpdate={onFieldUpdate}
          onPendingEditsChange={onPendingEditsChange}
        />
      );
    case 'dio':
      return <DioContainer animal={animal} onFieldUpdate={onFieldUpdate} />;
    case 'optogenetics':
      return (
        <>
          {getAnimalSectionStatus(animal, 'optogenetics') === SECTION_STATUS.TODO && (
            // An unconfigured opto tab is a VALID state, not an error — a neutral chip says so, so
            // the empty section doesn't read as missing setup (charter tab→content map).
            <p className="animal-view-status-chip" data-testid="opto-status-chip">
              Not used — no stimulation
            </p>
          )}
          <OptogeneticsContainer animalId={animalId} />
        </>
      );
    default:
      return (
        <div className="section-placeholder">
          <h2>{TAB_LABEL[tab] || 'Section'}</h2>
          <p>
            This section moves here in a later phase. For now, configure it in{' '}
            <a href={`#/animal/${animalId}/days`}>Animal Setup</a>.
          </p>
        </div>
      );
  }
}

/**
 * AnimalView component.
 *
 * @param {object} props
 * @param {string} props.animalId - The animal whose view to render.
 * @param {string} props.tab - The active tab (route `:tab` segment).
 * @returns {React.Element}
 */
export function AnimalView({ animalId, tab }) {
  const { model, actions } = useStoreContext();
  const { animals = {} } = model.workspace;
  const animal = animalId ? animals[animalId] : null;

  // Whether the header ⋮'s type-to-confirm animal-delete dialog is open. Deleting the viewed animal
  // leaves the route pointing at a now-missing id, which the not-found guard below handles (no
  // stranding). The shared AnimalDeleteDialog owns the cascade copy + the typed-id gate.
  const [animalDeleteOpen, setAnimalDeleteOpen] = useState(false);

  // Shared store-bound field-update + repair callbacks for the `{ animal, onFieldUpdate }` setup
  // containers (recording-system / cameras / dio), the corruption banner, and the profile save —
  // the same wiring the legacy stepper uses, so logic is never forked.
  const { handleFieldUpdate, handleRepair } = useAnimalFieldUpdate(animalId);

  // Transient reconfiguration context from the hash (`?context=reconfigure&version=…`) — the same
  // parser the legacy stepper reads, so the header banner can't drift from the stepper's.
  const routeContext = useReconfigContext();

  // Phase 3a.5: which setup tabs hold an export-blocking error (for the section-nav red dot). Reuses
  // the export validator + the repair-routing attribution — no second mapping. Memoized off the
  // animal + days so it recomputes only when the data changes.
  const blockingSections = useMemo(
    () => getAnimalBlockingSections(animal, model.workspace.days),
    [animal, model.workspace.days]
  );

  // Decision 10: each section-nav row carries a right-aligned count (information scent). The setup
  // counts are cheap selector reads; the day-work counts come from the SAME sources the rest of the
  // view uses — `classifyAnimalDays` (present day records) and the export validator's per-animal
  // rows (`buildAnimalRows`, "N ready" = valid days) — so the nav can never disagree with the days
  // tab / the export tab. Memoized off the animal + days.
  const sectionCounts = useMemo(() => {
    if (!animal) return null;
    const dayCount = classifyAnimalDays(animalId, animal, model.workspace.days).filter((d) =>
      isPresentRecordStatus(d.status)
    ).length;
    const readyCount = buildAnimalRows(model.workspace, animalId).filter(
      (r) => r.chip === 'valid'
    ).length;
    return {
      days: String(dayCount),
      export: `${readyCount} ready`,
      ...Object.fromEntries(
        Object.entries(getAnimalSetupCounts(animal)).map(([k, n]) => [k, String(n)])
      ),
      // Opto is "used" when configured; the never-configured case shows the ○ todo ring instead (so
      // an unused-opto row reads as a valid empty state, not a "0").
      optogenetics: 'used',
    };
  }, [animal, animalId, model.workspace]);

  const panelRef = useRef(null);
  const isFirstRender = useRef(true);

  // Unsaved-edit guard (charter decision 2). A setup container reports `true` while its
  // editor/modal is open; the shell owns the section-nav, so it intercepts a link to ANOTHER tab
  // and asks the user to confirm discarding before allowing the route to change. `setPendingEdits`
  // is a stable useState setter, so passing it as the container's `onPendingEditsChange` doesn't
  // thrash the container's reporting effect.
  const [pendingEdits, setPendingEdits] = useState(false);
  const [pendingNavTab, setPendingNavTab] = useState(null);

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
    let highlighted = null;
    let removeTimer = null;
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const requested = normalizeFieldPath(field);
      const match = Array.from(panel.querySelectorAll('[data-field-path]')).find((el) => {
        const anchor = normalizeFieldPath(el.getAttribute('data-field-path'));
        return anchor !== '' && (requested === anchor || requested.startsWith(anchor));
      });
      if (!match) return;
      if (typeof match.scrollIntoView === 'function') match.scrollIntoView({ block: 'nearest' });
      match.classList.add('repair-target-highlight');
      highlighted = match;
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
      <main id="main-content" tabIndex="-1" role="main" aria-labelledby="animal-view-heading">
        <h1 id="animal-view-heading">Animal not found</h1>
        <p>
          No animal “{animalId}” in this workspace.{' '}
          <a href="#/workspace">Back to Workspace</a>.
        </p>
      </main>
    );
  }

  const subject = getAnimalSubject(animal);
  const facts = [subject.species, subject.sex].filter(Boolean).join(' · ');

  /**
   * Intercept a section-nav activation when the active setup container has pending edits, so a
   * switch to ANOTHER tab is confirmed before the route changes (charter decision 2). Same-tab
   * clicks and the no-pending-edits case fall through to the link's normal hash navigation.
   * @param {React.MouseEvent} event - The anchor click.
   * @param {string} targetKey - The :tab the link points at.
   */
  const handleNavClick = (event, targetKey) => {
    if (targetKey === tab || !pendingEdits) return;
    // Let the browser handle a modifier / non-primary click (open-in-new-tab etc.) — that opens a
    // SEPARATE document and never discards the edit in THIS one, so it must not be intercepted.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      return;
    }
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
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="animal-view-heading">
      <header className="animal-view-header">
        <h1 id="animal-view-heading">{animal.id}</h1>
        <span className="animal-view-idbadge">subject_id</span>
        {facts && <span className="animal-view-facts">{facts}</span>}
        {/* Per-animal lifecycle ⋮ — the SAME reusable menu + type-to-confirm dialog as the picker
            card, so animal delete reads one truth from either surface (Task 4.1). */}
        <div className="animal-view-header-actions">
          <OverflowMenu
            label={`Actions for ${animal.id}`}
            items={[
              {
                key: 'open',
                label: 'Open',
                onSelect: () => {
                  window.location.hash = `#/animal/${animalId}/days`;
                },
              },
              { key: 'rename', label: 'Rename…', onSelect: () => {}, disabled: true },
              {
                key: 'delete',
                label: 'Delete animal…',
                onSelect: () => setAnimalDeleteOpen(true),
              },
            ]}
          />
        </div>
      </header>

      {/* Subject facts + reconfiguration context belong in the header band (NOT a tab — Phase 3-4):
          visible regardless of which setup tab is open. Same AnimalProfileSection (with its
          blast-radius confirm) and shared ReconfigurationContextBanner the legacy stepper renders.
          dayCount uses getAnimalDayIds(animal).length — the SAME count the stepper passes — so the
          "affects N days" confirm copy is byte-identical. */}
      <ReconfigurationContextBanner
        animal={animal}
        routeContext={routeContext}
        days={model.workspace.days}
      />
      <AnimalProfileSection
        animal={animal}
        dayCount={getAnimalDayIds(animal).length}
        onSave={(subject) => handleFieldUpdate('subject', subject)}
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

      <div className="animal-view-body">
        <nav className="section-nav" aria-label="Animal sections">
          {SECTION_GROUPS.map((group) => (
            <div className="section-nav-group" key={group.label}>
              <div className="section-nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const active = tab === item.key;
                // A BLOCKING export error (red ●) outranks a never-configured TODO (hollow ○): the
                // blocker is the more urgent signal, and the accessible name carries the meaning.
                const isBlocking = blockingSections.has(item.key);
                const isTodo =
                  !isBlocking && getAnimalSectionStatus(animal, item.key) === SECTION_STATUS.TODO;
                const ariaLabel = isBlocking
                  ? `${item.label} — blocks export`
                  : isTodo
                    ? `${item.label} — not set up`
                    : undefined;
                return (
                  <a
                    key={item.key}
                    href={`#/animal/${animalId}/${item.key}`}
                    className={`section-nav-item ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    aria-label={ariaLabel}
                    onClick={(event) => handleNavClick(event, item.key)}
                  >
                    <span className="section-nav-item-name">{item.label}</span>
                    {/* Decision 10 trailing affordance: name · [● blocking] · count · › — all
                        aria-hidden visual "information scent" (the link's accessible name still
                        carries the blocking/todo meaning via aria-label, so SR users are unaffected
                        and name-based queries stay stable). A blocking section keeps its red ● AND
                        shows its count (e.g. Cameras ● 2); a never-configured section shows the
                        neutral hollow-○ ring IN the count slot (no bare "0"). */}
                    {isBlocking && (
                      <span className="section-nav-blocking" aria-hidden="true">●</span>
                    )}
                    {isTodo ? (
                      <span className="section-nav-todo" aria-hidden="true">○</span>
                    ) : (
                      <span className="section-nav-count" aria-hidden="true">
                        {sectionCounts?.[item.key]}
                      </span>
                    )}
                    <span className="section-nav-chev" aria-hidden="true">›</span>
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <section
          className="animal-view-panel"
          aria-label={TAB_LABEL[tab] || 'Section'}
          tabIndex="-1"
          ref={panelRef}
        >
          {TAB_SCOPE[tab] && (
            <p className="animal-view-panel-scope" data-testid={`panel-scope-${tab}`}>
              {TAB_SCOPE[tab]}
            </p>
          )}
          {/* `data-field-path` marks the section a `?field=` repair deep-link highlights (3a.3). */}
          <div data-field-path={TAB_FIELD_ANCHOR[tab]}>
            {renderPanel({
              tab,
              animalId,
              animal,
              onPendingEditsChange: setPendingEdits,
              onFieldUpdate: handleFieldUpdate,
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

      <AnimalDeleteDialog
        isOpen={animalDeleteOpen}
        animalId={animalId}
        animal={animal}
        days={model.workspace.days}
        onConfirm={() => {
          setAnimalDeleteOpen(false);
          actions.deleteAnimal(animalId);
        }}
        onCancel={() => setAnimalDeleteOpen(false)}
      />
    </main>
  );
}

AnimalView.propTypes = {
  animalId: PropTypes.string,
  tab: PropTypes.string,
};

export default AnimalView;
