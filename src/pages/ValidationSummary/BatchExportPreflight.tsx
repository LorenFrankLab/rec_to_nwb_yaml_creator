import WarningAcknowledgement from '../../components/WarningAcknowledgement';
import { describeConfigVersionLabel } from '../../viewModels/validationSummaryRows';
import type { PendingExport } from './useValidationSummaryActions';
import styles from './ValidationSummary.module.css';
import Button from '../../components/ui/Button';
import { pluralize } from '../../utils/pluralize';
import EffectiveDayReview from '../../components/EffectiveDayReview';
import StatescriptReminder from '../../components/StatescriptReminder';

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
  // Describe the most common recorded team once per animal; exceptions stay on their days.
  const teams = new Map<string, Map<string, number>>();
  pendingExport.preflight.forEach((entry) => {
    const animalId = entry.records?.animal.id;
    const team = entry.comparison?.experimenters;
    if (!animalId || !team) return;
    const counts = teams.get(animalId) ?? new Map<string, number>();
    counts.set(team, (counts.get(team) ?? 0) + 1);
    teams.set(animalId, counts);
  });
  const commonTeams = new Map([...teams].map(([animalId, counts]) => [animalId, [...counts].sort((a, b) => b[1] - a[1])[0][0]]));
  return (
    <section className={styles.batchExportPreflight} aria-label="Batch export preflight">
      <h2>Review recordings for download</h2>
      <p>
        {pendingExport.rows.length} {pluralize(pendingExport.rows.length, 'day')} will
        be downloaded as YAML files. Review the setup for each recording:
      </p>
      {[...commonTeams].map(([animalId, team]) => <p key={animalId}><strong>{animalId} · Experimenters:</strong> {team}</p>)}
      <ul className={styles.batchExportPreflightList}>
        {pendingExport.preflight.map((entry) => (
          <li key={entry.dayId} className={styles.batchExportPreflightItem}>
            <span className={styles.batchExportPreflightLabel}>{entry.label}</span>
            {entry.error ? (
              <span className={styles.batchExportPreflightError}>
                Could not assemble metadata: {entry.error}
              </span>
            ) : (
              <div className={styles.batchExportPreflightDetail}>
                {entry.comparison && <>
                  <span className={styles.downloadState}>{entry.downloadStatus}</span>
                  <dl className={styles.comparison}>
                    <dt>Measured weight</dt><dd>{entry.comparison.weight}</dd>
                    {entry.comparison.experimenters !== commonTeams.get(entry.records?.animal.id ?? '') && <><dt>Experimenters for this day</dt><dd>{entry.comparison.experimenters}</dd></>}
                    <dt>Epochs &amp; files</dt><dd>{entry.comparison.tasksAndVideos}</dd>
                  </dl>
                </>}
                <StatescriptReminder epochs={entry.missingStatescripts ?? []} dayId={entry.dayId} />
                <details>
                  <summary>Calibration &amp; hardware details</summary>
                  {entry.records ? <EffectiveDayReview {...entry.records} showFileReminders={false} omitLabels={['Animal & day', 'Weight & team', 'Tasks & videos']} warningCount={entry.warnings?.length ?? 0} /> : <span>
                {describeConfigVersionLabel(entry.version as number | null, entry.historical as boolean)}; {entry.groups}{' '}
                electrode {pluralize(entry.groups, 'group')}, {entry.failedChannels}{' '}
                failed {pluralize(entry.failedChannels, 'channel')}; {entry.cameras}{' '}
                {pluralize(entry.cameras, 'camera')}; {entry.opto}
                  </span>}
                </details>
              </div>
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
          Download {pendingExport.rows.length} YAML files
        </Button>
        <Button variant="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}
