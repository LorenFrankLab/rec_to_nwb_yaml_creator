import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useStoreContext } from '../state/StoreContext';
import {
  parseWorkspaceBackup,
  readPreservedBlob,
  WORKSPACE_CHECKPOINT_KEY,
  WORKSPACE_QUARANTINE_KEY,
  WORKSPACE_PREMIGRATION_KEY,
} from '../state/persistence';
import type { PreservedBlob, ParsedBackup, BackupArtifacts } from '../state/persistence';
import type { Workspace } from '../state/workspaceTypes';
import {
  summarizeWorkspace,
  diffWorkspaceReplacement,
  estimateStorageUse,
} from '../domain/workspaceBackup';
import type { WorkspaceSummary, WorkspaceReplacementDiff } from '../domain/workspaceBackup';
import { downloadText, downloadWorkspaceBackup } from './downloadWorkspaceBackup';
import { Modal } from './Modal';
import Button from './ui/Button';
import styles from './WorkspaceBackupPanel.module.css';

/** A restore candidate awaiting confirmation. */
interface RestoreCandidate {
  source: string;
  workspace: Workspace;
  /** The last-download YAML bytes the backup carries (restored into this browser's side store). */
  artifacts: BackupArtifacts;
  summary: WorkspaceSummary;
  diff: WorkspaceReplacementDiff;
  recoveredNote: string | null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KiB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString();
}

/**
 * WorkspaceBackupPanel — "Saved on this browser": where the data lives, how much room it uses, and
 * the portable backup / restore flow (finding F8).
 *
 * - **Download workspace backup** writes the whole persisted workspace (incomplete days, setup
 *   history, provenance, export receipts) to a JSON file — the minimum viable transfer between a
 *   recording computer and an office computer.
 * - **Restore from backup** parses a file WITHOUT touching storage, shows a preview (what the file
 *   holds; which animals/days the replacement would drop, add, or change), and only replaces the
 *   current workspace on explicit confirmation — with a one-click "download current first".
 * - **Last known good** restores the checkpoint (the blob that hydrated cleanly at session start, or
 *   the last explicit save), same preview + confirm.
 * - **Kept copies** of data that could not be loaded (quarantine) or that was migrated
 *   (pre-migration) can be downloaded as-is.
 */
export default function WorkspaceBackupPanel() {
  const { model, persistence } = useStoreContext();
  const workspace = model.workspace as Workspace;
  const [candidate, setCandidate] = useState<RestoreCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [kept, setKept] = useState<{ checkpoint: PreservedBlob | null; quarantine: PreservedBlob | null; premigration: PreservedBlob | null }>({
    checkpoint: null,
    quarantine: null,
    premigration: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // The preserved copies live in the async side store; read them once (and after each restore).
  const [refreshToken, setRefreshToken] = useState(0);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      readPreservedBlob(WORKSPACE_CHECKPOINT_KEY),
      readPreservedBlob(WORKSPACE_QUARANTINE_KEY),
      readPreservedBlob(WORKSPACE_PREMIGRATION_KEY),
    ]).then(([checkpoint, quarantine, premigration]) => {
      if (!cancelled) setKept({ checkpoint, quarantine, premigration });
    });
    return () => {
      cancelled = true;
    };
  }, [refreshToken, persistence.lastSaved]);

  const usage = estimateStorageUse(workspace);
  const readOnly = persistence.enabled && persistence.writer.role !== 'writer';

  const downloadBackup = async () => {
    await downloadWorkspaceBackup(workspace);
    setNotice('Backup downloaded. Keep it somewhere other than this browser.');
  };

  const prepareCandidate = (source: string, parsed: ParsedBackup) => {
    setError(null);
    if (!parsed || !parsed.workspace) {
      const reason = parsed && 'discarded' in parsed ? parsed.discarded : 'unreadable';
      setError(
        reason === 'version-mismatch'
          ? `${source} was written by a newer or unknown app version and cannot be restored here.`
          : `${source} is not a readable workspace backup (${reason}).`
      );
      return;
    }
    const incoming = parsed.workspace as unknown as Workspace;
    setCandidate({
      source,
      workspace: incoming,
      artifacts: parsed.artifacts,
      summary: summarizeWorkspace(incoming),
      diff: diffWorkspaceReplacement(workspace, incoming),
      recoveredNote:
        'recovered' in parsed && parsed.recovered
          ? `The file was missing sections (${parsed.recovered.missingKeys.join(', ')}); they were restored as empty.`
          : null,
    });
  };

  const onPickFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const text = await file.text();
    prepareCandidate(`"${file.name}"`, parseWorkspaceBackup(text));
  };

  const restoreCheckpoint = () => {
    if (!kept.checkpoint) return;
    prepareCandidate(
      `the last known good copy (${formatWhen(kept.checkpoint.savedAt)})`,
      parseWorkspaceBackup(kept.checkpoint.raw)
    );
  };

  const confirmRestore = async () => {
    if (!candidate) return;
    const ok = await persistence.restoreWorkspace(candidate.workspace, candidate.artifacts);
    if (ok) {
      setNotice(`Workspace restored from ${candidate.source}.`);
      setCandidate(null);
      setRefreshToken((n) => n + 1);
    }
  };

  const summary = summarizeWorkspace(workspace);

  return (
    <section className={styles.panel} aria-labelledby="workspace-backup-heading">
      <h2 id="workspace-backup-heading" className={styles.heading}>
        Saved on this browser
      </h2>
      <p className={styles.lede}>
        Your workspace is stored only in this browser on this computer
        {persistence.lastSaved ? ` (last saved ${formatWhen(persistence.lastSaved)})` : ''}.
        {' '}It uses {formatBytes(usage.bytes)} of the {formatBytes(5 * 1024 * 1024)} the smallest supported
        browser allows. Download a backup to move work to another computer or to keep a copy.
      </p>
      {usage.fraction > 0.6 && (
        <p className={styles.warning} role="status">
          This workspace is using {(usage.fraction * 100).toFixed(0)}% of the browser storage budget.
          Download a backup now; if it keeps growing, export finished animals and remove them here.
        </p>
      )}
      {readOnly && (
        <p className={styles.warning} role="status">
          This tab is read-only (another tab is editing). You can download a backup; restoring
          requires taking over editing first.
        </p>
      )}

      <div className={styles.actions}>
        <Button variant="primary" size="small" onClick={downloadBackup}>
          Download workspace backup
        </Button>
        <Button variant="secondary" size="small" onClick={() => fileInputRef.current?.click()} disabled={readOnly}>
          Restore from backup…
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="visually-hidden"
          aria-label="Choose a workspace backup file"
          onChange={onPickFile}
        />
        {kept.checkpoint && (
          <Button variant="secondary" size="small" onClick={restoreCheckpoint} disabled={readOnly}>
            Restore last known good ({formatWhen(kept.checkpoint.savedAt)})
          </Button>
        )}
      </div>

      {(kept.quarantine || kept.premigration) && (
        <div className={styles.kept}>
          <h3 className={styles.subheading}>Kept copies</h3>
          {kept.quarantine && (
            <p>
              Data that could not be loaded on {formatWhen(kept.quarantine.savedAt)} ({kept.quarantine.reason})
              {persistence.originalUnpreserved
                ? ' is still in this browser’s storage because no durable copy of it could be made. Nothing is saved until you download it; the download clears it and lets saving resume.'
                : ' was kept as-is.'}{' '}
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  downloadText(`rec_to_nwb_workspace_quarantine_${kept.quarantine!.savedAt.slice(0, 10)}.json`, kept.quarantine!.raw);
                  if (persistence.originalUnpreserved) persistence.acknowledgeUnpreservedOriginal();
                }}
              >
                Download original data
              </button>
            </p>
          )}
          {kept.premigration && (
            <p>
              The workspace was upgraded from storage version {kept.premigration.schemaVersion ?? '?'} on{' '}
              {formatWhen(kept.premigration.savedAt)}; the pre-upgrade copy was kept.{' '}
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => downloadText(`rec_to_nwb_workspace_pre-upgrade_${kept.premigration!.savedAt.slice(0, 10)}.json`, kept.premigration!.raw)}
              >
                Download pre-upgrade copy
              </button>
            </p>
          )}
        </div>
      )}

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}

      <Modal
        isOpen={candidate != null}
        onClose={() => setCandidate(null)}
        title="Replace the current workspace?"
        titleId="restore-preview-title"
        role="alertdialog"
        footer={
          candidate && (
            <div className={styles.modalActions}>
              <Button variant="secondary" onClick={() => setCandidate(null)}>
                Cancel
              </Button>
              {!candidate.diff.currentIsEmpty && (
                <Button variant="secondary" onClick={downloadBackup}>
                  Download current first
                </Button>
              )}
              <Button variant="danger" onClick={confirmRestore}>
                Replace workspace
              </Button>
            </div>
          )
        }
      >
        {candidate && (
          <div className={styles.preview}>
            <p>
              Restoring from {candidate.source} replaces everything in this browser&apos;s workspace.
            </p>
            {candidate.recoveredNote && <p className={styles.warning}>{candidate.recoveredNote}</p>}
            <dl className={styles.previewGrid}>
              <dt>In the backup</dt>
              <dd>
                {candidate.summary.animals} {candidate.summary.animals === 1 ? 'animal' : 'animals'},{' '}
                {candidate.summary.days} recording {candidate.summary.days === 1 ? 'day' : 'days'}
                {candidate.summary.firstDate ? ` (${candidate.summary.firstDate} – ${candidate.summary.lastDate})` : ''}
                ; {candidate.summary.incompleteDays} incomplete, {candidate.summary.exportedDays} downloaded.
                {candidate.summary.lastModified ? ` Last modified ${formatWhen(candidate.summary.lastModified)}.` : ''}
              </dd>
              <dt>Open now</dt>
              <dd>
                {summary.animals} {summary.animals === 1 ? 'animal' : 'animals'}, {summary.days} recording{' '}
                {summary.days === 1 ? 'day' : 'days'}; {summary.incompleteDays} incomplete.
              </dd>
              <dt>Replacing would</dt>
              <dd>
                {candidate.diff.currentIsEmpty ? (
                  'add everything in the backup (the current workspace is empty).'
                ) : (
                  <ul className={styles.diffList}>
                    <li>
                      <strong>drop</strong> {candidate.diff.animalsDropped.length} animal(s)
                      {candidate.diff.animalsDropped.length > 0 ? ` (${candidate.diff.animalsDropped.join(', ')})` : ''} and{' '}
                      {candidate.diff.daysDropped.length} day(s) that exist only here
                    </li>
                    <li>
                      <strong>add</strong> {candidate.diff.animalsAdded.length} animal(s) and {candidate.diff.daysAdded.length} day(s)
                    </li>
                    <li>
                      <strong>change</strong> {candidate.diff.daysChanged.length} day(s) present in both
                    </li>
                  </ul>
                )}
              </dd>
            </dl>
          </div>
        )}
      </Modal>
    </section>
  );
}
