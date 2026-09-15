import { useState } from 'react';
import { useStoreContext } from '../state/StoreContext';
import type { Workspace } from '../state/workspaceTypes';
import { downloadWorkspaceBackup } from './downloadWorkspaceBackup';
import Button from './ui/Button';
import styles from './ReadOnlyTabBanner.module.css';

/**
 * ReadOnlyTabBanner — shown when this tab does NOT hold the workspace writer lease (finding F4).
 *
 * A second tab of the app opens read-only: it follows the editing tab's saves live and never
 * writes — its editing controls are disabled (AppLayout) and the store refuses mutations. The
 * banner explains that, offers to take over editing (the other tab saves and hands the lease
 * over — or refuses, with the reason shown here), and keeps a backup download reachable since
 * reading is not editing. Self-hides for the writer.
 */
export default function ReadOnlyTabBanner() {
  const { model, persistence } = useStoreContext();
  const [busy, setBusy] = useState(false);
  if (!persistence.enabled || persistence.writer.role === 'writer') return null;

  const pending = persistence.writer.role === 'pending';
  const handedOver = persistence.writer.role === 'reader' && persistence.writer.reason === 'handed-over';
  const takeOver = async () => {
    setBusy(true);
    try {
      await persistence.takeOver();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.banner} role="status" aria-live="polite">
      <span className={styles.text}>
        {pending
          ? 'Checking whether another tab is editing this workspace…'
          : handedOver
            ? 'Editing moved to another tab. This tab is now read-only: it shows that tab’s saved changes, and its editing controls are disabled.'
            : 'Another tab is editing this workspace, so this tab is read-only: it shows the saved changes live, and its editing controls are disabled.'}
      </span>
      {!pending && (
        <span className={styles.actions}>
          <Button variant="secondary" size="small" onClick={takeOver} disabled={busy}>
            {busy ? 'Taking over…' : 'Edit in this tab instead'}
          </Button>
          <Button variant="secondary" size="small" onClick={() => downloadWorkspaceBackup(model.workspace as Workspace)}>
            Download workspace backup
          </Button>
        </span>
      )}
      {persistence.saveError && (
        <span className={styles.error} role="alert">
          {persistence.saveError}
        </span>
      )}
    </div>
  );
}
