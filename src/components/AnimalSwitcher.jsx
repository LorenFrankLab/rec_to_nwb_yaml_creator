import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { getPresentDayCount } from '../domain/dayRecovery';
import OverflowMenu from './OverflowMenu';
import './AnimalSwitcher.css';

/**
 * AnimalSwitcher — the top object-selector dropdown `Workspace ▸ <animal> ▾` (Phase 4, Task 4.5 /
 * decision 9).
 *
 * It is a DISCLOSURE popup, NOT a `role="listbox"` and NOT a `role="menu"` (those ARIA patterns
 * forbid options/menuitems that host secondary controls). The trigger is a `button[aria-haspopup]`;
 * the popup is a labelled `role="group"` whose rows each carry a PRIMARY switch link (→
 * `#/animal/:id/days`, the current animal `aria-current`) plus a SECONDARY ⋮ menubutton (the shared
 * {@link OverflowMenu}, its own `role="menu"`: Open / Rename… / Delete animal…). A trailing
 * "+ New animal…" button opens the create panel. Keyboard: Esc closes + returns focus to the
 * trigger; Up/Down rove between the rows (and the new-animal button); focus enters the popup on open;
 * an outside click closes. No focus trap — the nested ⋮ owns its own roving focus + Esc.
 *
 * Lifecycle (create / delete) is delegated UP so a single host (AppLayout) owns one create panel and
 * one delete dialog — the switcher never duplicates them.
 *
 * @param {object} props
 * @param {string} props.currentAnimalId - The animal currently being viewed (shown in the trigger,
 *   marked `aria-current` in the list).
 * @param {object} props.animals - The workspace animals map.
 * @param {object} props.days - The workspace days map (for per-row day counts).
 * @param {Function} props.onRequestDelete - Called with an animal id when a row's Delete is chosen.
 * @param {Function} props.onRequestCreate - Called when "+ New animal…" is chosen.
 * @returns {JSX.Element}
 */
export default function AnimalSwitcher({
  currentAnimalId,
  animals,
  days,
  onRequestDelete,
  onRequestCreate,
}) {
  const popupId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const popupRef = useRef(null);
  // Roving-focus targets: the per-row switch links followed by the "+ New animal…" button. The ⋮
  // menubuttons are intentionally NOT roving targets (they are reached via Tab and own their menu).
  const rowRefs = useRef([]);

  const animalIds = Object.keys(animals);

  /** Close the popup and optionally return focus to the trigger. */
  const close = useCallback((returnFocus = false) => {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }, []);

  // On open, move focus into the popup onto the current animal's row (or the first row).
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, animalIds.indexOf(currentAnimalId));
    rowRefs.current[idx]?.focus();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on an outside click (pointerdown, so it beats row clicks). A click on the trigger is
  // handled by its own onClick.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (popupRef.current?.contains(e.target) || triggerRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  /**
   * Roving + dismissal for the popup. Esc closes (→ trigger); Up/Down move between roving targets.
   * Arrow keys originating inside a row's ⋮ menu never reach here (OverflowMenu stops them), so a
   * bare arrow here always means "move between rows".
   * @param {React.KeyboardEvent} e - The keydown event.
   */
  const handlePopupKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    // Only live (still-attached) roving targets, so a stale ref from a since-removed row (were the
    // list to change while the popup is open) can't trap focus on a detached node.
    const targets = rowRefs.current.filter((el) => el && el.isConnected);
    const idx = targets.indexOf(document.activeElement);
    if (idx === -1) return; // focus is on a ⋮ trigger — let it handle the key
    e.preventDefault();
    const dir = e.key === 'ArrowDown' ? 1 : -1;
    targets[(idx + dir + targets.length) % targets.length]?.focus();
  };

  /**
   * Day RECORDS present for an animal (indexed + recovered), via the shared recovery count.
   * @param {string} animalId - The animal whose present-day records to count.
   * @returns {number} The count of present day records.
   */
  const dayCountFor = (animalId) => getPresentDayCount(animalId, animals[animalId], days);

  return (
    <div className="animal-switcher">
      <button
        ref={triggerRef}
        type="button"
        className="animal-switcher-trigger"
        aria-label={`Switch animal (current: ${currentAnimalId})`}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={() => (open ? close(false) : setOpen(true))}
      >
        <span className="animal-switcher-av" aria-hidden="true">
          {String(currentAnimalId).slice(0, 2)}
        </span>
        <span className="animal-switcher-current">{currentAnimalId}</span>
        <span className="animal-switcher-chev" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div
          ref={popupRef}
          id={popupId}
          role="group"
          aria-label="Switch animal"
          className="animal-switcher-popup"
          onKeyDown={handlePopupKeyDown}
        >
          <div className="animal-switcher-label" aria-hidden="true">
            Animals
          </div>
          {animalIds.map((animalId, index) => {
            const isCurrent = animalId === currentAnimalId;
            const count = dayCountFor(animalId);
            return (
              <div
                key={animalId}
                className={`animal-switcher-row${isCurrent ? ' is-current' : ''}`}
              >
                <a
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  href={`#/animal/${animalId}/days`}
                  className="animal-switcher-switch"
                  aria-current={isCurrent ? 'true' : undefined}
                  onClick={() => close(false)}
                >
                  <span className="animal-switcher-av" aria-hidden="true">
                    {animalId.slice(0, 2)}
                  </span>
                  <span className="animal-switcher-name">{animalId}</span>
                </a>
                <span className="animal-switcher-count" aria-hidden="true">
                  {count} {count === 1 ? 'day' : 'days'}
                </span>
                <OverflowMenu
                  label={`${animalId} actions`}
                  buttonClassName="animal-switcher-kebab"
                  items={[
                    {
                      key: 'open',
                      label: 'Open',
                      onSelect: () => {
                        close(false);
                        window.location.hash = `#/animal/${animalId}/days`;
                      },
                    },
                    { key: 'rename', label: 'Rename…', onSelect: () => {}, disabled: true },
                    {
                      key: 'delete',
                      label: 'Delete animal…',
                      onSelect: () => {
                        close(false);
                        onRequestDelete(animalId);
                      },
                    },
                  ]}
                />
              </div>
            );
          })}
          <div className="animal-switcher-sep" role="separator" />
          <button
            ref={(el) => {
              rowRefs.current[animalIds.length] = el;
            }}
            type="button"
            className="animal-switcher-new"
            onClick={() => {
              close(false);
              onRequestCreate();
            }}
          >
            <span className="animal-switcher-plus" aria-hidden="true">
              +
            </span>
            New animal…
          </button>
        </div>
      )}
    </div>
  );
}

AnimalSwitcher.propTypes = {
  currentAnimalId: PropTypes.string.isRequired,
  animals: PropTypes.object.isRequired,
  days: PropTypes.object,
  onRequestDelete: PropTypes.func.isRequired,
  onRequestCreate: PropTypes.func.isRequired,
};

AnimalSwitcher.defaultProps = {
  days: {},
};
