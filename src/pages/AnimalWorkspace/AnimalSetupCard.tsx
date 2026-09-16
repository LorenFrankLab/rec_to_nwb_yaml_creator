import type { SectionViewModel } from '../../viewModels/types';
import styles from './AnimalWorkspace.module.css';
import Button from '../../components/ui/Button';

/**
 * The static per-section hints, keyed by the setup-section key. They state honestly WHEN a section
 * applies — animal facts and team are required for export; hardware depends on the experiment.
 * The section list + its status/verb now come from the view-model; only this advisory copy is local.
 */
const SECTION_HINTS: Record<string, string> = {
  identity: 'required before export',
  team: 'defaults for new days',
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
  resumeHref: string;
}

/**
 * The first-run onboarding card for a new/under-configured animal. Renders the per-section setup
 * state straight from the view-model's `setupSections` — the same `getAnimalSectionStatus` /
 * `getAnimalBlockingSections` truth the section-nav rings read, so "todo" isn't signalled two ways and
 * the card can't tell the user a section is fine while the nav shows it red. The parent decides
 * WHETHER to render it (it disappears once the animal is established).
 */
export default function AnimalSetupCard({ sections, hasOtherAnimals, onCopyFromAnimal, resumeHref }: AnimalSetupCardProps) {
  const renderSection = (section: SectionViewModel) => {
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
  };
  const hardware = sections.filter((section) => !['identity', 'team', 'recording-system'].includes(section.key));
  const hardwareIssues = hardware.filter((section) => section.status === 'error').length;
  const remaining = sections.filter((section) => section.status === 'error' ||
    (['identity', 'team', 'recording-system'].includes(section.key) && section.status === 'todo'));
  return (
    <details className={styles.setupReminder} aria-label="Set up this animal">
      <summary>Setup to finish: {remaining.map((section) => section.label).join(', ') || 'Review applicable hardware'}</summary>
      <div className={styles.setupCard}>
      <h3 className={styles.setupCardHeading}>Set up this animal</h3>
      <p className={styles.setupCardIntro}>
        Finish animal facts and reusable defaults when you have them. You can log recording days while setup is incomplete.
      </p>
      <p><a href={resumeHref} className={styles.setupCardItemAction}>Resume setup</a></p>
      {hasOtherAnimals && (
        <Button
          variant="secondary"
          className={styles.setupCardCopyButton}
          onClick={onCopyFromAnimal}
          aria-label="Copy from another animal — electrode groups, cameras, recording system"
        >
          Copy from another animal…
        </Button>
      )}
      <ul className={styles.setupCardList}>
        {sections.filter((section) => ['identity', 'team', 'recording-system'].includes(section.key) && section.status !== 'ready').map(renderSection)}
      </ul>
      <details className={styles.setupHardware}>
        <summary>Hardware setup{hardwareIssues > 0 ? ` · ${hardwareIssues} to review` : ' · as needed'}</summary>
        <ul className={styles.setupCardList}>{hardware.map(renderSection)}</ul>
      </details>
      </div>
    </details>
  );
}
