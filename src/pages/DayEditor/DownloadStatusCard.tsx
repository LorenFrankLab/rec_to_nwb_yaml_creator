import { useEffect, useState } from 'react';
import { exportFreshness, RECEIPT_YAML_KEY_PREFIX } from '../../domain/exportReceipt';
import type { ExportArtifact } from '../../domain/exportReceipt';
import { diffLines, compactDiff } from '../../domain/lineDiff';
import type { DiffLine } from '../../domain/lineDiff';
import { getBlob } from '../../state/blobStore';
import type { Animal, Day } from '../../state/workspaceTypes';
import styles from './DownloadStatusCard.module.css';

interface DownloadStatusCardProps {
  animal: Animal;
  day: Day;
  /** The current export (filename + yaml + hash), or null when the merge failed. */
  artifact: ExportArtifact | null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

/**
 * DownloadStatusCard — the export review's "changes since the last download" (finding F6).
 *
 * States: never downloaded · Downloaded (current) · Changed since download (with the filename /
 * content differences and a compact line diff against the stored bytes when they were kept) ·
 * Downloaded before receipts existed (content not verifiable — download again to be sure). A
 * download is stated as a download, never as a successful conversion.
 */
export default function DownloadStatusCard({ animal, day, artifact }: DownloadStatusCardProps) {
  const fresh = exportFreshness(animal, day, artifact);
  // `undefined` = not looked up yet; `null` = looked up, the bytes are not in this browser.
  const [previous, setPrevious] = useState<{ filename: string; yaml: string } | null | undefined>(undefined);
  const [diffOpen, setDiffOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPrevious(undefined);
    if (fresh.status !== 'changed' || !fresh.receipt?.yamlStored) return undefined;
    getBlob<{ filename?: string; yaml?: string }>(`${RECEIPT_YAML_KEY_PREFIX}${day.id}`).then((stored) => {
      if (cancelled) return;
      if (!stored || typeof stored.yaml !== 'string') {
        setPrevious(null);
        return;
      }
      setPrevious({ filename: String(stored.filename ?? fresh.receipt?.filename ?? ''), yaml: stored.yaml });
    });
    return () => {
      cancelled = true;
    };
  }, [day.id, fresh.status, fresh.receipt?.yamlStored, fresh.receipt?.exportedAt, fresh.receipt?.filename]);

  if (fresh.status === 'never') {
    return (
      <p className={styles.card} data-testid="download-status" data-status="never">
        Not downloaded yet.
      </p>
    );
  }
  const receipt = fresh.receipt!;
  if (fresh.status === 'unverified') {
    return (
      <div className={`${styles.card} ${styles.unverified}`} data-testid="download-status" data-status="unverified">
        <p>
          Downloaded as <code>{receipt.filename}</code> on {formatWhen(receipt.exportedAt)} by an earlier version of this
          app — that download cannot be compared with the current export. Download again to be sure the file next to
          your <code>.rec</code> files is current.
        </p>
      </div>
    );
  }
  if (fresh.status === 'current') {
    return (
      <div className={`${styles.card} ${styles.current}`} data-testid="download-status" data-status="current">
        <p>
          Downloaded as <code>{receipt.filename}</code> on {formatWhen(receipt.exportedAt)}; nothing has changed since.
          (A download is not proof that the conversion succeeded — see the pilot runbook for the converter check.)
        </p>
      </div>
    );
  }

  const rows: DiffLine[] | null = previous && artifact ? compactDiff(diffLines(previous.yaml, artifact.yaml)) : null;
  const changedLines = rows ? rows.filter((r) => r.kind !== 'same').length : null;
  return (
    <div className={`${styles.card} ${styles.changed}`} data-testid="download-status" data-status="changed" role="status">
      <p className={styles.heading}>Changed since download</p>
      <p>
        Last downloaded as <code>{receipt.filename}</code> on {formatWhen(receipt.exportedAt)}.{' '}
        {fresh.differs.includes('filename') && artifact ? (
          <>
            The filename is now <code>{artifact.filename}</code>
            {fresh.differs.includes('content') ? ' and the content differs' : ''}.
          </>
        ) : (
          'The content differs.'
        )}{' '}
        Download it again and replace the file next to your <code>.rec</code> files.
      </p>
      {rows && changedLines != null && changedLines > 0 && (
        <details open={diffOpen} onToggle={(e) => setDiffOpen((e.currentTarget as HTMLDetailsElement).open)}>
          <summary>
            {diffOpen ? 'Hide' : 'Show'} what changed ({changedLines} {changedLines === 1 ? 'line' : 'lines'})
          </summary>
          <pre className={styles.diff} aria-label="Changes since the last download">
            {rows.map((row, i) => (
              <div
                key={i}
                className={row.kind === 'added' ? styles.added : row.kind === 'removed' ? styles.removed : styles.same}
              >
                <span aria-hidden="true">{row.kind === 'added' ? '+ ' : row.kind === 'removed' ? '− ' : '  '}</span>
                {row.text}
              </div>
            ))}
          </pre>
        </details>
      )}
      {previous === undefined && receipt.yamlStored && <p className={styles.muted}>Loading the previous download for comparison…</p>}
      {(!receipt.yamlStored || previous === null) && (
        <p className={styles.muted}>
          The previous download’s bytes are not available in this browser, so a line-by-line comparison is not
          possible (the content hash still shows it differs).
        </p>
      )}
    </div>
  );
}
