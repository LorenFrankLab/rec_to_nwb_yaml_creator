import styles from './BlastRadiusChip.module.css';
import { pluralize } from '../../utils/pluralize';

export interface BlastRadiusChipProps {
  /** How many recording days this animal-static edit affects. */
  dayCount: number;
}

/**
 * BlastRadiusChip — the "affects all N days" amber chip shown next to an animal-static edit control
 * whose change forces affected days to re-export. The full warning rides on the title (hover
 * tooltip). It annotates the animal-static edits whose change invalidates exported days — Identity,
 * Cameras, Optogenetics — but not Team (past days keep their recorded experimenters) or additive
 * task-type adds.
 */
const BlastRadiusChip = ({ dayCount }: BlastRadiusChipProps) => {
  const noun = pluralize(dayCount, 'day');
  const tooltip = `Shared by all ${dayCount} ${noun} — already-exported days will need re-export.`;
  return (
    <span className={styles.chip} title={tooltip}>
      <span className={styles.icon} aria-hidden="true">
        ⚠
      </span>
      Affects all {dayCount} {noun}
    </span>
  );
};

export default BlastRadiusChip;
