import PropTypes from 'prop-types';
import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  SECTION_STATUS,
} from '../../domain/sectionStatus';

/**
 * The first-run "Set up this animal" card sections, in the same order and with the same keys as
 * the section-nav "Animal setup" group (so the card and the nav rings read ONE truth via
 * {@link getAnimalSectionStatus}). The `hint` states honestly WHEN a section applies — none is
 * mandatory, because a behavior-only day needs no electrodes (overview decision 7).
 */
const SETUP_CARD_SECTIONS = [
  { key: 'electrode-groups', label: 'Electrode Groups', hint: 'if ephys' },
  { key: 'recording-system', label: 'Recording System', hint: 'data acquisition' },
  { key: 'cameras', label: 'Cameras', hint: 'if video' },
  { key: 'optogenetics', label: 'Optogenetics', hint: 'if opto' },
];

/**
 * The first-run onboarding card for a new/under-configured animal. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change. Reads the SAME
 * per-section todo/blocking state as the section-nav rings ({@link getAnimalSectionStatus} /
 * {@link getAnimalBlockingSections}), so "todo" isn't signalled three ways and the card can't tell
 * the user a section is fine while the nav shows it red. The parent decides WHETHER to render it
 * (it disappears once the animal is established).
 *
 * @param {object} props
 * @param {string} props.animalId - The animal whose setup this card drives (for the section links).
 * @param {object} props.animal - The animal record (read for per-section status).
 * @param {object} props.days - The workspace days map (read for blocking-section derivation).
 * @param {boolean} props.hasOtherAnimals - Whether a "Copy from another animal…" affordance applies.
 * @param {Function} props.onCopyFromAnimal - Opens the copy-from-animal dialog.
 * @returns {JSX.Element}
 */
export default function AnimalSetupCard({ animalId, animal, days, hasOtherAnimals, onCopyFromAnimal }) {
  // Which setup sections hold an export-blocking error — the SAME source the section-nav red ●
  // reads (no second mapping), so the card's per-section state can't contradict the nav.
  const setupBlockingSections = getAnimalBlockingSections(animal, days);
  return (
    <section className="setup-card" aria-label="Set up this animal">
      <h3 className="setup-card-heading">Set up this animal</h3>
      <p className="setup-card-intro">
        Configure the shared hardware this animal&apos;s recording days will
        reference. Add only what your recordings use — a behavior-only day needs no
        electrodes, and each section is referenced per day.
      </p>
      {hasOtherAnimals && (
        <button
          type="button"
          className="setup-card-copy-button button-secondary"
          onClick={onCopyFromAnimal}
          aria-label="Copy from another animal — electrode groups, cameras, recording system"
        >
          Copy from another animal…
        </button>
      )}
      <ul className="setup-card-list">
        {SETUP_CARD_SECTIONS.map((section) => {
          // Three honest states that AGREE with the section-nav (decision 11): a section
          // that holds an export-BLOCKING error reads "Needs fixing" (never "Done"), so
          // the onboarding card can't tell the user a section is fine while the nav shows
          // it red. Blocking outranks the neutral never-configured "To do".
          const blocking = setupBlockingSections.has(section.key);
          const todo =
            !blocking &&
            getAnimalSectionStatus(animal, section.key) === SECTION_STATUS.TODO;
          const stateLabel = blocking ? 'Needs fixing' : todo ? 'To do' : 'Done';
          const actionVerb = blocking ? 'Fix' : todo ? 'Set up' : 'Review';
          const itemModifier = blocking
            ? 'setup-card-item-blocking'
            : todo
              ? 'setup-card-item-todo'
              : 'setup-card-item-done';
          return (
            <li key={section.key} className={`setup-card-item ${itemModifier}`}>
              <span className="setup-card-item-name">{section.label}</span>
              <span className="setup-card-item-hint">{section.hint}</span>
              <span className="setup-card-item-state">{stateLabel}</span>
              <a
                className="setup-card-item-action"
                href={`#/animal/${animalId}/${section.key}`}
                // A links-list reader hears six actions; name each by its section
                // ("Set up Cameras", not a non-unique "Set up →"). The arrow is decorative.
                aria-label={`${actionVerb} ${section.label}`}
              >
                {actionVerb} <span aria-hidden="true">→</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

AnimalSetupCard.propTypes = {
  animalId: PropTypes.string.isRequired,
  animal: PropTypes.object.isRequired,
  days: PropTypes.object.isRequired,
  hasOtherAnimals: PropTypes.bool.isRequired,
  onCopyFromAnimal: PropTypes.func.isRequired,
};
