import { useMemo, useState } from 'react';
import { encodeYaml, formatDeterministicFilename } from '../../io/yaml';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { exportDayFile } from '../../domain/exportDay';
import type { ExportDayActions } from '../../domain/exportDay';
import { checkShadowExport } from '../../domain/shadowExport';
import { isFeatureEnabled } from '../../featureFlags';
import { useUndoToast } from '../../components/ui/UndoToast';
import RepairActions from './RepairActions';
import type { RepairDispatch } from './RepairActions';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import { exportAllDays } from './exportPreviewBatch';
import type { ExportAllResult } from './exportPreviewBatch';
import type { IssueViewModel, ExportGateViewModel } from '../../viewModels/types';
import styles from './ExportPreview.module.css';

interface ExportPreviewProps extends DayEditorBundle {
  /** The classified issue list (`vm.issues`) — the blocked region's repair list reads its errors. */
  issues?: IssueViewModel[];
  /** The authoritative export gate (`vm.export`): readiness, the blocking reason, and the disabled reason. */
  exportGate?: ExportGateViewModel;
  /** Routes a repair to the step/surface that owns the fix (and an optional field target). */
  onNavigate?: (stepId: string, fieldPath?: string) => void;
  /** Executes an issue's repair command in place (reconstructed from the view-model). */
  onRepair?: (dispatch: RepairDispatch) => void;
  /** The full workspace (`{ animals, days }`) — read by the "Export all days" batch only. */
  workspace?: unknown;
}

/**
 * ExportPreview — the day's export surface (replaces `ExportStep`).
 *
 * Shows the readiness gate (issue-driven, field-linked when blocking), the derived download filename,
 * a read-only preview of the REAL export bytes (`encodeYaml(mergeDayMetadata(animal, day))`), Download
 * and Copy actions (BOTH gated while blocking — both emit the YAML, so Copy is not a gate bypass), and
 * an "Export all days" batch that reuses the shared exporter.
 *
 * It is a thin renderer over already-tested layers: the gate + classified issues come from the
 * view-model (`vm.export` / `vm.issues`, the authoritative `validateDay`-driven gate — never a local
 * re-check); the blocked repair list is the shared {@link RepairActions}; the single download is the
 * shared {@link exportDayFile} core (parity gate + mark-exported); the batch is {@link exportAllDays}
 * (the same `exportDayFile` core over every day, never a second export path).
 */
export default function ExportPreview(props: ExportPreviewProps) {
  const { animal, day, animalKey = undefined, actions = {} } = useDayEditorContext(props);
  const { issues = [], exportGate, onNavigate = () => {}, onRepair, workspace } = props;
  const ownerKey = animalKey ?? (animal as { id?: string })?.id;

  const { show: showToast, node: toastNode } = useUndoToast();
  // A non-blocking notice for an export attempt that failed AFTER the gate (parity/encoder/clipboard) —
  // distinct from the gate's blocked state (which prevents the attempt entirely).
  const [actionError, setActionError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<ExportAllResult | null>(null);

  // Merge once: the preview body, the filename, and the merge-error state all derive from this single
  // merged object (the same bytes the download/copy emit), never duplicate component state.
  const { yaml, fileName, mergeError } = useMemo(() => {
    try {
      const merged = mergeDayMetadata(animal, day);
      return {
        yaml: encodeYaml(merged),
        // mergeDayMetadata carries no EXPERIMENT_DATE_in_format_mmddYYYY (a filename-only key); inject it
        // from the day so the filename doesn't degrade to the literal placeholder. Filename only.
        fileName: formatDeterministicFilename({
          ...merged,
          EXPERIMENT_DATE_in_format_mmddYYYY: (day as { experimentDate?: string }).experimentDate,
        }),
        mergeError: false,
      };
    } catch {
      return { yaml: '', fileName: '', mergeError: true };
    }
  }, [animal, day]);

  // The gate is the view-model's authoritative export gate; absent → fail closed (blocked).
  const blocked = !exportGate?.open;
  const disabledReason = exportGate?.action?.disabledReason;
  const vmErrorIssues = issues.filter((issue) => issue.severity === 'error');
  const strict = isFeatureEnabled('shadowExportStrict');
  const dayCount = getAnimalDayIds(animal).length;

  const handleDownload = () => {
    if (blocked) return; // fail closed even if the disabled attribute is bypassed
    const outcome = exportDayFile(animal, day, { actions: actions as unknown as ExportDayActions, strict });
    switch (outcome.kind) {
      case 'exported':
        setActionError(null);
        showToast(`✓ Downloaded ${fileName}`);
        break;
      case 'overridden':
        // The bytes shipped, but a parity mismatch was overridden (strict mode off). Per the
        // exportDay contract this must be surfaced LOUDLY, never swallowed into a clean success.
        setActionError(
          `Downloaded ${fileName}, but the encoder-stability check mismatched (strict mode off). Review the file before use.`
        );
        break;
      case 'skipped':
        setActionError('Export blocked: the encoder-stability check failed. Open the day to review.');
        break;
      case 'failed':
        setActionError(`Export failed: ${outcome.message}`);
        break;
    }
  };

  const handleCopy = () => {
    if (blocked) return; // the readiness gate blocks Copy too — Copy emits the SAME YAML as Download
    const clip = navigator.clipboard;
    if (!clip?.writeText) {
      setActionError('Copy is not available in this browser — use Download instead.');
      return;
    }
    // Copy ships the SAME bytes Download does, so it runs the SAME encoder-stability/parity gate — it
    // is not a way around it. A strict-mode mismatch blocks the copy; a strict-off mismatch copies the
    // canonical bytes with a loud override notice (mirroring the download path's `exportDayFile`).
    const { ok, yaml: bytes } = checkShadowExport(animal, day);
    if (!ok && strict) {
      setActionError('Copy blocked: the encoder-stability check failed. Open the day to review.');
      return;
    }
    clip
      .writeText(bytes)
      .then(() => {
        setActionError(
          ok
            ? null
            : 'Copied to the clipboard, but the encoder-stability check mismatched (strict mode off). Review the file before use.'
        );
        showToast('✓ YAML copied');
      })
      .catch(() => setActionError('Could not copy to the clipboard — use Download instead.'));
  };

  const handleExportAll = () => {
    if (!workspace || ownerKey == null) return;
    setBatchResult(exportAllDays(workspace, ownerKey, { actions: actions as unknown as ExportDayActions, strict }));
  };

  return (
    <div className={styles.surface}>
      <header className={styles.header}>
        <h2 className={styles.title}>Export — {(day as { date?: string }).date}</h2>
        <p className={styles.lede}>
          Review the file this day will write, then download it next to your <code>.rec</code> files.
        </p>
      </header>

      {/* Readiness gate — issue-driven. Quiet when clean; loud + field-linked when blocking. */}
      {blocked ? (
        <div className={styles.blocked} role="alert">
          <p className={styles.blockedHeading}>{exportGate?.message ?? 'Export is blocked.'}</p>
          {vmErrorIssues.length > 0 ? (
            <RepairActions
              issues={vmErrorIssues}
              onNavigate={onNavigate}
              animalId={ownerKey}
              onRepair={onRepair}
              groupByCategory
            />
          ) : (exportGate?.blockingSteps?.length ?? 0) > 0 ? (
            <div className={styles.stepBlockers}>
              {exportGate!.blockingSteps.map((step) => {
                const action = step.action;
                if (!action) return null;
                return action.href ? (
                  <a key={step.key} className="repair-action-button" data-repair-surface="animal" href={action.href}>
                    {action.label}
                  </a>
                ) : (
                  <button
                    key={step.key}
                    type="button"
                    className="repair-action-button"
                    onClick={() => onNavigate(step.key, undefined)}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={styles.ready} role="status">
          <span className={styles.readyIcon} aria-hidden="true">
            ✓
          </span>{' '}
          Ready to export
        </div>
      )}

      {/* The file this day will write: its deterministic name + the REAL export bytes (read-only). */}
      {!mergeError && (
        <div className={styles.filecard}>
          <div className={styles.filebar}>
            <span className={styles.fname}>{fileName}</span>
            <span className={styles.fmeta}>one file · this recording day</span>
          </div>
          <pre className={styles.code} aria-label="YAML preview">
            {yaml}
          </pre>
        </div>
      )}

      <div className={styles.actions}>
        <button
          type="button"
          className="button-primary"
          onClick={handleDownload}
          disabled={blocked}
          title={blocked ? disabledReason : `Download ${fileName}`}
        >
          Download
        </button>
        <button
          type="button"
          className="button-secondary"
          onClick={handleCopy}
          disabled={blocked}
          title={blocked ? disabledReason : 'Both Download and Copy produce the file'}
        >
          Copy
        </button>
      </div>

      {actionError && (
        <div className={styles.actionError} role="alert">
          {actionError}
        </div>
      )}

      {/* Batch: export every day of this animal (only the days that pass checks). */}
      {dayCount > 1 && (
        <div className={styles.batch}>
          <p>
            Recording a block?{' '}
            <button type="button" className={styles.batchLink} onClick={handleExportAll}>
              Export all {dayCount} days
            </button>{' '}
            (one file each, only the days that pass checks).
          </p>
        </div>
      )}

      {batchResult && (
        <div className={styles.batchResult} role="status" aria-label="Batch export result">
          <p className={styles.batchHeading}>
            Exported {batchResult.exported.length}
            {batchResult.skipped.length > 0 ? ` · Skipped ${batchResult.skipped.length}` : ''}
          </p>
          {batchResult.exported.length > 0 && (
            <ul className={styles.batchList}>
              {batchResult.exported.map((row) => (
                <li key={row.dayId} className={styles.batchExported}>
                  <span className={styles.fname}>{row.filename}</span>
                </li>
              ))}
            </ul>
          )}
          {batchResult.skipped.length > 0 && (
            <ul className={styles.batchList}>
              {batchResult.skipped.map((row) => (
                <li key={row.dayId} className={styles.batchSkipped}>
                  {row.date} skipped — {row.message}{' '}
                  {row.fixHref && (
                    <a href={row.fixHref} className={styles.batchFix}>
                      {row.fixLabel ?? 'Fix & export →'}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {toastNode}
    </div>
  );
}
