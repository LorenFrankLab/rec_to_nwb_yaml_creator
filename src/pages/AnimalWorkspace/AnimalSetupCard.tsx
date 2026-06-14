import {
  getAnimalSectionStatus,
  getAnimalBlockingSections,
  SECTION_STATUS,
} from '../../domain/sectionStatus';
import type { Animal, Day } from '../../state/workspaceTypes';
import styles from './AnimalWorkspace.module.css';

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

interface AnimalSetupCardProps {
  /** The animal whose setup this card drives (for the section links). */
  animalId: string;
  /** The animal record (read for per-section status). */
  animal: Animal;
  /** The workspace days map (read for blocking-section derivation). */
  days: Record<string, Day>;
  /** Whether a "Copy from another animal…" affordance applies. */
  hasOtherAnimals: boolean;
  /** Opens the copy-from-animal dialog. */
  onCopyFromAnimal: () => void;
}

/**
 * The first-run onboarding card for a new/under-configured animal. Extracted from
 * `pages/AnimalWorkspace/RecordingDaysTab.jsx` (Phase 9c-2) with no behavior change. Reads the SAME
 * per-section todo/blocking state as the section-nav rings ({@link getAnimalSectionStatus} /
 * {@link getAnimalBlockingSections}), so "todo" isn't signalled three ways and the card can't tell
 * the user a section is fine while the nav shows it red. The parent decides WHETHER to render it
 * (it disappears once the animal is established).
 */
export default function AnimalSetupCard({ animalId, animal, days, hasOtherAnimals, onCopyFromAnimal }: AnimalSetupCardProps) {
  // Which setup sections hold an export-blocking error — the SAME source the section-nav red ●
  // reads (no second mapping), so the card's per-section state can't contradict the nav.
  const setupBlockingSections = getAnimalBlockingSections(animal, days);
  return (
    <section className={styles.setupCard} aria-label="Set up this animal">
      <h3 className={styles.setupCardHeading}>Set up this animal</h3>
      <p className={styles.setupCardIntro}>
        Configure the shared hardware this animal&apos;s recording days will
        reference. Add only what your recordings use — a behavior-only day needs no
        electrodes, and each section is referenced per day.
      </p>
      {hasOtherAnimals && (
        <button
          type="button"
          className={`${styles.setupCardCopyButton} button-secondary`}
          onClick={onCopyFromAnimal}
          aria-label="Copy from another animal — electrode groups, cameras, recording system"
        >
          Copy from another animal…
        </button>
      )}
      <ul className={styles.setupCardList}>
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
          // `done` is the default green state styled on the state pill itself — it has no row
          // modifier rule, so it contributes no class (was an unstyled `setup-card-item-done` marker).
          const itemModifier = blocking
            ? styles.setupCardItemBlocking
            : todo
              ? styles.setupCardItemTodo
              : '';
          return (
            <li key={section.key} className={`${styles.setupCardItem} ${itemModifier}`}>
              <span className={styles.setupCardItemName}>{section.label}</span>
              <span className={styles.setupCardItemHint}>{section.hint}</span>
              <span className={styles.setupCardItemState}>{stateLabel}</span>
              <a
                className={styles.setupCardItemAction}
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

