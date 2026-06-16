import styles from './BlastRadiusChip.module.css';

export interface BlastRadiusChipProps {
  /** How many recording days this animal-static edit affects. */
  dayCount: number;
  /** Optional tooltip override; defaults to the re-export warning. */
  title?: string;
}

/**
 * BlastRadiusChip — the "affects all N days" amber chip shown next to an animal-static edit control
 * whose change forces affected days to re-export. The full warning rides on the title (hover
 * tooltip). Animal-static edits this annotates: Identity, Cameras, Optogenetics (per the design).
 */
const BlastRadiusChip = ({ dayCount, title }: BlastRadiusChipProps) => {
  const noun = dayCount === 1 ? 'day' : 'days';
  const tooltip =
    title ?? `Shared by all ${dayCount} ${noun} — already-exported days will need re-export.`;
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
