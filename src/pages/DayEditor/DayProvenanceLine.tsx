import { getConfigHistory, getDayDataAcqDeviceName, getDataAcqDevices } from '../../state/workspaceSelectors';
import { configurationChoiceStatus } from '../../domain/configurationSelection';
import type { Day } from '../../state/workspaceTypes';
import styles from './DayProvenanceLine.module.css';

interface DayProvenanceLineProps {
  animal: unknown;
  day: Day;
  /** Open the "start from a different day" picker (omitted when there is no other day). */
  onChangeSource?: () => void;
  /** Go to the Recording Setup section (configuration version + rig). */
  onChangeSetup?: () => void;
}

/** ISO date → "Jun 22, 2023". */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function shortDate(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(iso ?? '');
  const [y, m, d] = iso.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`;
}

/**
 * DayProvenanceLine — one compact statement of where this day's copied facts came from and which
 * setup applies: "Started from Jun 22 · Probe setup v1 (effective Jun 1) · Rig SpikeGadgets ·
 * entered Sep 14, 2026". The three dates (recording, setup effective, entry) stay distinct. An
 * unconfirmed setup choice is called out here as well as in the readiness bar.
 */
export default function DayProvenanceLine({ animal, day, onChangeSource, onChangeSetup }: DayProvenanceLineProps) {
  const provenance = day?.provenance;
  const choice = configurationChoiceStatus(animal, day);
  const history = getConfigHistory(animal);
  const rigName = getDayDataAcqDeviceName(day) || getDataAcqDevices(animal)[0]?.name || null;
  const entered = provenance?.enteredAt ? new Date(provenance.enteredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const source =
    provenance?.copiedFromDate
      ? `Started from ${shortDate(provenance.copiedFromDate)}`
      : provenance?.origin === 'import' || provenance?.configuration?.source === 'import' || Object.values(provenance?.fields ?? {}).includes('import')
        ? 'Imported from a YAML file'
        : 'Started blank';

  let setup: string;
  if (choice.status === 'unpinned') {
    setup = history.length > 0 ? 'Probe setup not pinned' : 'No probe setup (behavior-only is fine)';
  } else {
    const snapshot = history.find((entry) => entry.version === choice.version);
    const eff = snapshot?.effectiveDateKnown === false
      ? ' (effective date unknown)'
      : choice.effectiveDate ? ` (effective ${shortDate(choice.effectiveDate)})` : '';
    setup = `Probe setup v${choice.version}${eff}`;
  }

  return (
    <p className={styles.line} data-testid="day-provenance">
      <span>{source}</span>
      <span className={styles.sep} aria-hidden="true">·</span>
      <span className={choice.status === 'unconfirmed' ? styles.warn : undefined}>
        {setup}
        {choice.status === 'unconfirmed' ? ' — not confirmed for this date' : ''}
      </span>
      {rigName && (
        <>
          <span className={styles.sep} aria-hidden="true">·</span>
          <span>Rig {rigName}</span>
        </>
      )}
      {entered && (
        <>
          <span className={styles.sep} aria-hidden="true">·</span>
          <span className={styles.muted}>entered {entered}</span>
        </>
      )}
      {onChangeSource && (
        <button type="button" className={styles.linkButton} onClick={onChangeSource}>
          Change source…
        </button>
      )}
      {onChangeSetup && (
        <button type="button" className={styles.linkButton} onClick={onChangeSetup}>
          Change setup
        </button>
      )}
    </p>
  );
}
