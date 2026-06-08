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

import React, { useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useStoreContext } from '../../state/StoreContext';
import { getAnimalSubject } from '../../state/workspaceSelectors';
import { RecordingDaysTab } from '../AnimalWorkspace/RecordingDaysTab';
import './AnimalView.css';

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
 * AnimalView component.
 *
 * @param {object} props
 * @param {string} props.animalId - The animal whose view to render.
 * @param {string} props.tab - The active tab (route `:tab` segment).
 * @returns {React.Element}
 */
export function AnimalView({ animalId, tab }) {
  const { model } = useStoreContext();
  const { animals = {} } = model.workspace;
  const animal = animalId ? animals[animalId] : null;

  const panelRef = useRef(null);
  const isFirstRender = useRef(true);

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

  if (!animal) {
    // Task 1.5 (lite): a cold deep-link can arrive before the store hydrates (no animals at all)
    // -> "Loading"; an id that's simply absent while others exist -> "Animal not found". Never
    // the stepper's bare "Animal not found" crash path on a cold load.
    const hasAnyAnimal = Object.keys(animals).length > 0;
    return (
      <main id="main-content" tabIndex="-1" role="main" aria-labelledby="animal-view-heading">
        <h1 id="animal-view-heading">{hasAnyAnimal ? 'Animal not found' : 'Loading…'}</h1>
        {hasAnyAnimal ? (
          <p>
            No animal “{animalId}” in this workspace.{' '}
            <a href="#/workspace">Back to Workspace</a>.
          </p>
        ) : (
          <p>Loading workspace…</p>
        )}
      </main>
    );
  }

  const subject = getAnimalSubject(animal);
  const facts = [subject.species, subject.sex].filter(Boolean).join(' · ');

  return (
    <main id="main-content" tabIndex="-1" role="main" aria-labelledby="animal-view-heading">
      <header className="animal-view-header">
        <h1 id="animal-view-heading">{animal.id}</h1>
        <span className="animal-view-idbadge">subject_id</span>
        {facts && <span className="animal-view-facts">{facts}</span>}
      </header>

      <div className="animal-view-body">
        <nav className="section-nav" aria-label="Animal sections">
          {SECTION_GROUPS.map((group) => (
            <div className="section-nav-group" key={group.label}>
              <div className="section-nav-group-label">{group.label}</div>
              {group.items.map((item) => {
                const active = tab === item.key;
                return (
                  <a
                    key={item.key}
                    href={`#/animal/${animalId}/${item.key}`}
                    className={`section-nav-item ${active ? 'is-active' : ''}`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className="section-nav-item-name">{item.label}</span>
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
          {tab === 'days' ? (
            <RecordingDaysTab animalId={animalId} />
          ) : (
            <div className="section-placeholder">
              <h2>{TAB_LABEL[tab] || 'Section'}</h2>
              <p>
                This section moves here in a later phase. For now, configure it in{' '}
                <a href={`#/animal/${animalId}/editor`}>Animal Setup</a>.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

AnimalView.propTypes = {
  animalId: PropTypes.string,
  tab: PropTypes.string,
};

export default AnimalView;
