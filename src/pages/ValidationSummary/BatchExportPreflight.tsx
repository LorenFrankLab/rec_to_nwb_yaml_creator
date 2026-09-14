import WarningAcknowledgement from '../../components/WarningAcknowledgement';
import { describeConfigVersionLabel } from '../../viewModels/validationSummaryRows';
import type { PendingExport } from './useValidationSummaryActions';
import styles from './ValidationSummary.module.css';
import Button from '../../components/ui/Button';
import { pluralize } from '../../utils/pluralize';

interface BatchExportPreflightProps {
  /** The pending batch: the valid rows, the per-day preflight entries, and the days carrying warnings. */
  pendingExport: PendingExport;
  /** Whether outstanding warnings have been acknowledged. */
  warningsAcknowledged: boolean;
  /** Called with the new checkbox state. */
  onAcknowledgeChange: (acknowledged: boolean) => void;
  /** Run the actual downloads. */
  onConfirm: () => void;
  /** Discard the pending export. */
  onCancel: () => void;
}

/**
 * Step-2 confirmation for the batch "Export Valid Only" flow: lists what each file will contain
 * (config version, electrode groups, failed channels, cameras, opto), requires explicit
 * acknowledgement of any outstanding non-blocking warnings, and gates Confirm on that
 * acknowledgement. Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior
 * change — the confirm/cancel handlers and the warning-acknowledgement state stay owned by the
 * parent; this component only renders them.
 */
export default function BatchExportPreflight({
  pendingExport,
  warningsAcknowledged,
  onAcknowledgeChange,
  onConfirm,
  onCancel,
}: BatchExportPreflightProps) {
  const confirmDisabled = pendingExport.warningItems.length > 0 && !warningsAcknowledged;
  return (
    <section className={styles.batchExportPreflight} aria-label="Batch export preflight">
      <h2>Confirm batch export</h2>
      <p>
        {pendingExport.rows.length} {pluralize(pendingExport.rows.length, 'day')} will
        be encoded and downloaded. Review what each file will contain before exporting:
      </p>
      <ul className={styles.batchExportPreflightList}>
        {pendingExport.preflight.map((entry) => (
          <li key={entry.dayId} className={styles.batchExportPreflightItem}>
            <span className={styles.batchExportPreflightLabel}>{entry.label}</span>
            {entry.error ? (
              <span className={styles.batchExportPreflightError}>
                Could not assemble metadata: {entry.error}
              </span>
            ) : (
              <span className={styles.batchExportPreflightDetail}>
                {describeConfigVersionLabel(entry.version as number | null, entry.historical as boolean)}; {entry.groups}{' '}
                electrode {pluralize(entry.groups, 'group')}, {entry.failedChannels}{' '}
                failed {pluralize(entry.failedChannels, 'channel')}; {entry.cameras}{' '}
                {pluralize(entry.cameras, 'camera')}; {entry.opto}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* Phase 3-6: outstanding non-blocking warnings must be explicitly acknowledged before
          the download proceeds — a silent warning can otherwise ride the export across days. */}
      <WarningAcknowledgement
        items={pendingExport.warningItems}
        acknowledged={warningsAcknowledged}
        onChange={onAcknowledgeChange}
      />
      <div className={styles.batchExportPreflightActions}>
        <Button onClick={onConfirm} disabled={confirmDisabled}>
          Confirm export ({pendingExport.rows.length})
        </Button>
        <Button variant="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

