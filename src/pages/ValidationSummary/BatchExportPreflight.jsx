import PropTypes from 'prop-types';
import WarningAcknowledgement from '../../components/WarningAcknowledgement';
import { describeConfigVersionLabel } from './validationSummaryRows';

/**
 * Step-2 confirmation for the batch "Export Valid Only" flow: lists what each file will contain
 * (config version, electrode groups, failed channels, cameras, opto), requires explicit
 * acknowledgement of any outstanding non-blocking warnings, and gates Confirm on that
 * acknowledgement. Extracted from `pages/ValidationSummary/index.jsx` (Phase 9c) with no behavior
 * change — the confirm/cancel handlers and the warning-acknowledgement state stay owned by the
 * parent; this component only renders them.
 *
 * @param {object} props
 * @param {{ rows: object[], preflight: object[], warningItems: object[] }} props.pendingExport
 *   - The pending batch: the valid rows, the per-day preflight entries, and the days carrying warnings.
 * @param {boolean} props.warningsAcknowledged - Whether outstanding warnings have been acknowledged.
 * @param {Function} props.onAcknowledgeChange - `(acknowledged: boolean) => void` from the checkbox.
 * @param {Function} props.onConfirm - Run the actual downloads.
 * @param {Function} props.onCancel - Discard the pending export.
 * @returns {JSX.Element}
 */
export default function BatchExportPreflight({
  pendingExport,
  warningsAcknowledged,
  onAcknowledgeChange,
  onConfirm,
  onCancel,
}) {
  const confirmDisabled = pendingExport.warningItems.length > 0 && !warningsAcknowledged;
  return (
    <section className="batch-export-preflight" aria-label="Batch export preflight">
      <h2>Confirm batch export</h2>
      <p>
        {pendingExport.rows.length} {pendingExport.rows.length === 1 ? 'day' : 'days'} will
        be encoded and downloaded. Review what each file will contain before exporting:
      </p>
      <ul className="batch-export-preflight-list">
        {pendingExport.preflight.map((entry) => (
          <li key={entry.dayId} className="batch-export-preflight-item">
            <span className="batch-export-preflight-label">{entry.label}</span>
            {entry.error ? (
              <span className="batch-export-preflight-error">
                Could not assemble metadata: {entry.error}
              </span>
            ) : (
              <span className="batch-export-preflight-detail">
                {describeConfigVersionLabel(entry.version, entry.historical)}; {entry.groups}{' '}
                electrode {entry.groups === 1 ? 'group' : 'groups'}, {entry.failedChannels}{' '}
                failed {entry.failedChannels === 1 ? 'channel' : 'channels'}; {entry.cameras}{' '}
                {entry.cameras === 1 ? 'camera' : 'cameras'}; {entry.opto}
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
      <div className="batch-export-preflight-actions">
        <button type="button" className="btn-primary" onClick={onConfirm} disabled={confirmDisabled}>
          Confirm export ({pendingExport.rows.length})
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </section>
  );
}

BatchExportPreflight.propTypes = {
  pendingExport: PropTypes.shape({
    rows: PropTypes.array.isRequired,
    preflight: PropTypes.array.isRequired,
    warningItems: PropTypes.array.isRequired,
  }).isRequired,
  warningsAcknowledged: PropTypes.bool.isRequired,
  onAcknowledgeChange: PropTypes.func.isRequired,
  onConfirm: PropTypes.func.isRequired,
  onCancel: PropTypes.func.isRequired,
};
