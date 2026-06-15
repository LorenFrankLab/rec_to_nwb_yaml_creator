import type { SectionViewModel } from '../../viewModels/types';
import styles from './AnimalWorkspace.module.css';

/**
 * The static per-section hints, keyed by the setup-section key. They state honestly WHEN a section
 * applies — none is mandatory, because a behavior-only day needs no electrodes (overview decision 7).
 * The section list + its status/verb now come from the view-model; only this advisory copy is local.
 */
const SECTION_HINTS: Record<string, string> = {
  'electrode-groups': 'if ephys',
  'recording-system': 'data acquisition',
  cameras: 'if video',
  optogenetics: 'if opto',
};

interface AnimalSetupCardProps {
  /** The first-run setup-card sections, from `buildAnimalWorkspaceViewModel` (status + verb + link). */
  sections: SectionViewModel[];
  /** Whether a "Copy from another animal…" affordance applies. */
  hasOtherAnimals: boolean;
  /** Opens the copy-from-animal dialog. */
  onCopyFromAnimal: () => void;
}

/**
 * The first-run onboarding card for a new/under-configured animal. Renders the per-section setup
 * state straight from the view-model's `setupSections` — the same `getAnimalSectionStatus` /
 * `getAnimalBlockingSections` truth the section-nav rings read, so "todo" isn't signalled two ways and
 * the card can't tell the user a section is fine while the nav shows it red. The parent decides
 * WHETHER to render it (it disappears once the animal is established).
 */
export default function AnimalSetupCard({ sections, hasOtherAnimals, onCopyFromAnimal }: AnimalSetupCardProps) {
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
        {sections.map((section) => {
          // Three honest states that AGREE with the section-nav (decision 11): a section that holds
          // an export-BLOCKING error reads "Needs fixing" (never "Done"), so the onboarding card
          // can't tell the user a section is fine while the nav shows it red. The view-model already
          // mapped the status; `done` (ready) is the default green pill and contributes no modifier.
          const itemModifier =
            section.status === 'error'
              ? styles.setupCardItemBlocking
              : section.status === 'todo'
                ? styles.setupCardItemTodo
                : '';
          return (
            <li key={section.key} className={`${styles.setupCardItem} ${itemModifier}`}>
              <span className={styles.setupCardItemName}>{section.label}</span>
              <span className={styles.setupCardItemHint}>{SECTION_HINTS[section.key]}</span>
              <span className={styles.setupCardItemState}>{section.summary}</span>
              <a
                className={styles.setupCardItemAction}
                href={section.action?.href}
                // A links-list reader hears six actions; name each by its section
                // ("Set up Cameras", not a non-unique "Set up →"). The arrow is decorative.
                aria-label={`${section.action?.label} ${section.label}`}
              >
                {section.action?.label} <span aria-hidden="true">→</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
