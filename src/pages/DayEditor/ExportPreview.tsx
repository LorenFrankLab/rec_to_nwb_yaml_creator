import { isIncompleteEntryIssue } from '../../domain/validationPresentation';
import { useId, useMemo, useState } from 'react';
import { encodeYaml } from '../../io/yaml';
import { formatRecordingMetadataFilename } from '../../domain/recordingFilename';
import { getAnimalSubject } from '../../state/workspaceSelectors';
import DownloadStatusCard from './DownloadStatusCard';
import { receiptHash } from '../../domain/exportReceipt';
import { mergeDayMetadata } from '../../state/workspaceUtils';
import { getAnimalDayIds } from '../../state/workspaceSelectors';
import { exportDayFile } from '../../domain/exportDay';
import type { ExportDayActions } from '../../domain/exportDay';
import { checkShadowExport } from '../../domain/shadowExport';
import { isFeatureEnabled } from '../../featureFlags';
import { useUndoToast } from '../../components/ui/UndoToast';
import EffectiveDayReview from '../../components/EffectiveDayReview';
import RepairActions from './RepairActions';
import type { RepairDispatch } from './RepairActions';
import { useDayEditorContext } from './DayEditorContext';
import type { DayEditorBundle } from './DayEditorContext';
import type { IssueViewModel, ExportGateViewModel } from '../../viewModels/types';
import styles from './ExportPreview.module.css';
import { blockingIssues, isAdvisoryIssue } from '../../validation/issueTypes';
import { pluralize } from '../../utils/pluralize';
import Button from '../../components/ui/Button';
import { missingStatescriptEpochs } from '../../viewModels/epochGridViewModel';

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
  /** Pending/rejected input values must be accepted into the workspace before bytes are emitted. */
  hasPendingDrafts?: boolean;
}

/**
 * ExportPreview — the day's export surface (replaces `ExportStep`).
 *
 * Shows the readiness gate (issue-driven, field-linked when blocking), a readable review of what the
 * file will SAY (the shared {@link EffectiveDayReview}, placed between the gate and the actions so the
 * values are read BEFORE the download), the derived download filename, a read-only preview of the REAL
 * export bytes (`encodeYaml(mergeDayMetadata(animal, day))`), Download and Copy actions (BOTH gated
 * while blocking — both emit the YAML, so Copy is not a gate bypass), and an "Export all days" batch
 * that reuses the shared exporter.
 *
 * It is a thin renderer over already-tested layers: the gate + classified issues come from the
 * view-model (`vm.export` / `vm.issues`, the authoritative `validateDay`-driven gate — never a local
 * re-check); the review is the SAME component (and the same `buildPreflightSummary` derivation) the
 * per-animal Validation summary renders, never a second summary; the blocked repair list is the shared
 * {@link RepairActions}; the single download is the shared {@link exportDayFile} core
 * (parity gate + mark-exported); the batch is {@link exportAllDays}
 * (the same `exportDayFile` core over every day, never a second export path).
 */
export default function ExportPreview(props: ExportPreviewProps) {
  const { animal, day, animalDays, animalKey = undefined, actions = {} } = useDayEditorContext(props);
  const { issues = [], exportGate, onNavigate = () => {}, onRepair, hasPendingDrafts = false } = props;
  const ownerKey = animalKey ?? (animal as { id?: string })?.id;

  const { show: showToast, node: toastNode } = useUndoToast();
  // A non-blocking notice for an export attempt that failed AFTER the gate (parity/encoder/clipboard) —
  // distinct from the gate's blocked state (which prevents the attempt entirely).
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Ties the review's caption to its region without a hand-written DOM id (unique per instance).
  const reviewCaptionId = useId();

  // Merge once: the preview body, the filename, and the merge-error state all derive from this single
  // merged object (the same bytes the download/copy emit), never duplicate component state.
  const { yaml, fileName, mergeError } = useMemo(() => {
    try {
      const merged = mergeDayMetadata(animal, day);
      return {
        yaml: encodeYaml(merged),
        // The converter-grouped name: `{YYYYMMDD}_{exact subject}_metadata.yml` (see recordingFilename).
        fileName: formatRecordingMetadataFilename({
          date: day.date,
          subjectId: String(getAnimalSubject(animal).subject_id ?? ''),
        }),
        mergeError: false,
      };
    } catch {
      return { yaml: '', fileName: '', mergeError: true };
    }
  }, [animal, day]);

  // The gate is the view-model's authoritative export gate; absent → fail closed (blocked).
  const blocked = hasPendingDrafts || !exportGate?.open;
  const disabledReason = hasPendingDrafts
    ? 'A field edit has not been accepted yet. Return to it or retry Save before exporting.'
    : exportGate?.action?.disabledReason;
  const vmErrorIssues = blockingIssues(issues);
  const incompleteEntries = vmErrorIssues.length > 0 && vmErrorIssues.every(isIncompleteEntryIssue);
  // The SAME issue list the gate is decided from — the readiness line never re-derives a second
  // count. "Ready to export" must not sit beside an unexplained warning-toned badge elsewhere.
  const warningCount = issues.filter(isAdvisoryIssue).length;
  const fileReminderCount = missingStatescriptEpochs(animal, day, animalDays).length;
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



  return (
    <div className={styles.surface}>
      <header className={styles.header}>
        <h2 className={styles.title}>Review &amp; export — {(day as { date?: string }).date}</h2>
        <p className={styles.lede}>
          Review this recording, then save its metadata YAML beside the <code>.rec</code> files.
        </p>
      </header>

      {/* Readiness gate — issue-driven. Loud + field-linked when blocking; compact when clean. */}
      {blocked ? (
        <div className={incompleteEntries ? styles.incomplete : styles.blocked} role={incompleteEntries ? 'status' : 'alert'}>
          <p className={styles.blockedHeading}>
            {hasPendingDrafts
              ? 'An edit is still unsaved. Retry Save or return to the field before exporting.'
              : exportGate?.message ?? 'Export is blocked.'}
          </p>
          {!hasPendingDrafts && vmErrorIssues.length > 0 ? (
            <RepairActions
              issues={vmErrorIssues}
              onNavigate={onNavigate}
              animalId={ownerKey}
              onRepair={onRepair}
              groupByCategory
            />
          ) : !hasPendingDrafts && (exportGate?.blockingSteps?.length ?? 0) > 0 ? (
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
          {warningCount > 0 && ` · ${warningCount} ${pluralize(warningCount, 'warning')} to review`}
          {fileReminderCount > 0 && ` · ${fileReminderCount} optional ${pluralize(fileReminderCount, 'statescript')} to review`}
        </div>
      )}

      {/* What the file will SAY, in words — the defense against a plausible-but-wrong day (a weight
          carried over from another session, a task recorded in the wrong room, a stale calibration).
          It sits between the gate and the actions on purpose: read the values, THEN download. The
          same shared review the Validation summary shows, from the same merge the bytes come from. */}
      {!mergeError && (
        <section className={styles.review} aria-labelledby={reviewCaptionId}>
          <p className={styles.reviewCaption} id={reviewCaptionId}>
            Check these values before downloading.
          </p>
          <EffectiveDayReview animal={animal} day={day} animalDays={animalDays} warningCount={warningCount} onReviewStatescript={(epoch) => onNavigate('epochs', `epoch-${epoch}-statescript`)} />
        </section>
      )}

      <div className={styles.actions}>
        <Button
          onClick={handleDownload}
          disabled={blocked}
          title={blocked ? disabledReason : `Download ${fileName}`}
        >
          Download YAML
        </Button>
        <Button
          variant="secondary"
          onClick={handleCopy}
          disabled={blocked}
          title={blocked ? disabledReason : 'Both Download and Copy produce the file'}
        >
          Copy YAML
        </Button>
      </div>

      {/* Download history: never / current / changed since download (with what changed) / unverified. */}
      <DownloadStatusCard
        animal={animal}
        day={day}
        artifact={mergeError ? null : { filename: fileName, yaml, hash: receiptHash(fileName, yaml) }}
      />

      {/* The file this day will write: deterministic name + REAL export bytes, disclosed on demand. */}
      {!mergeError && (
        <details
          className={styles.filecard}
          open={previewOpen}
          onToggle={(event) => setPreviewOpen((event.currentTarget as HTMLDetailsElement).open)}
        >
          <summary className={styles.filebar}>
            <span className={styles.fname}>{fileName}</span>
            <span className={styles.fmeta}>{previewOpen ? 'Hide YAML' : 'View YAML'} · one file</span>
          </summary>
          <pre className={styles.code} aria-label="YAML preview">
            {yaml}
          </pre>
        </details>
      )}

      {actionError && (
        <div className={styles.actionError} role="alert">
          {actionError}
        </div>
      )}

      {dayCount > 1 && <p className={styles.batch}>
        <a href={`#/animal/${encodeURIComponent(String(ownerKey))}/export`}>Review other recordings for {ownerKey}</a>
      </p>}

      {toastNode}
    </div>
  );
}
