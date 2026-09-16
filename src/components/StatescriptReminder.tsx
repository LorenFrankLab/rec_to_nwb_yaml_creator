import { pluralize } from '../utils/pluralize';
import styles from './EffectiveDayReview.module.css';

/** A file-entry reminder, independent of validation and its warning acknowledgement gate. */
export default function StatescriptReminder({ epochs, dayId, onReview }: {
  epochs: number[];
  dayId: string;
  onReview?: (epoch: number) => void;
}) {
  if (!epochs.length) return null;
  return <div role="group" className={styles.fileReminder} aria-label="Optional file reminders">
    <strong>{epochs.length} expected {pluralize(epochs.length, 'statescript')} not listed</strong>
    <p>Optional for export. Add the logs if they were recorded, or continue without them.</p>
    <div className={styles.reminderLinks}>
      {epochs.map((epoch) => onReview
        ? <button key={epoch} type="button" onClick={() => onReview(epoch)}>Review epoch {epoch}</button>
        : <a key={epoch} href={`#/day/${encodeURIComponent(dayId)}?step=epochs&field=epoch-${epoch}-statescript`}>Review epoch {epoch}</a>)}
    </div>
  </div>;
}
