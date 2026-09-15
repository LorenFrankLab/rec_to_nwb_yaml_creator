import { useState } from 'react';
import { useStoreContext } from '../state/StoreContext';
import Button from './ui/Button';
import styles from './ReadOnlyTabBanner.module.css';

/**
 * ReadOnlyTabBanner — shown when this tab does NOT hold the workspace writer lease (finding F4).
 *
 * A second tab of the app opens read-only: it follows the editing tab's saves live and never
 * writes. The banner explains that, and offers to take over editing (the other tab saves and
 * hands the lease over). Self-hides for the writer.
 */
export default function ReadOnlyTabBanner() {
  const { persistence } = useStoreContext();
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
            ? 'Editing moved to another tab. This tab is now read-only and shows that tab’s saved changes; nothing typed here is saved.'
            : 'Another tab is editing this workspace, so this tab is read-only: it shows the saved changes live, but nothing typed here is saved.'}
      </span>
      {!pending && (
        <Button variant="secondary" size="small" onClick={takeOver} disabled={busy}>
          {busy ? 'Taking over…' : 'Edit in this tab instead'}
        </Button>
      )}
    </div>
  );
}
