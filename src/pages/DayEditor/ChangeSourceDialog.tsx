import { useState } from 'react';
import { Modal } from '../../components/Modal';
import Button from '../../components/ui/Button';
import type { Day } from '../../state/workspaceTypes';
import styles from './ChangeSourceDialog.module.css';

interface ChangeSourceDialogProps {
  isOpen: boolean;
  day: Day;
  animalDays: Day[];
  onConfirm: (sourceDayId: string) => void;
  onClose: () => void;
}

/**
 * ChangeSourceDialog — "Start this day from a different day". Lists the animal's other days
 * (nearest first) and re-copies the carry-forward fields from the chosen one. States exactly what is
 * copied and what is kept, so an explicit choice to copy a later day for a backfill is safe: the
 * measured weight, files and the date-selected probe setup are never overridden.
 */
export default function ChangeSourceDialog({ isOpen, day, animalDays, onConfirm, onClose }: ChangeSourceDialogProps) {
  const [choice, setChoice] = useState<string>('');
  const candidates = (animalDays ?? []).filter((d) => d && d.id !== day.id && typeof d.date === 'string');
  // Nearest date first.
  const ordered = [...candidates].sort((a, b) => {
    const da = Math.abs(new Date(a.date).getTime() - new Date(day.date).getTime());
    const db = Math.abs(new Date(b.date).getTime() - new Date(day.date).getTime());
    return da - db;
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Start this day from a different day"
      titleId="change-source-title"
      footer={
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" disabled={!choice} onClick={() => choice && onConfirm(choice)}>
            Copy from this day
          </Button>
        </div>
      }
    >
      <p className={styles.lede}>
        Copies the epoch plan, DIO events, search terms, technical parameters, optogenetics
        setup and rig choice from the chosen day (its data folder is re-dated). Keeps this day&apos;s
        measured weight, experimenters, descriptions, files, videos and probe setup.
      </p>
      <div className={styles.list} role="radiogroup" aria-label="Source day">
        {ordered.length === 0 && <p>No other recording day to copy from.</p>}
        {ordered.map((d) => (
          <label key={d.id} className={styles.option}>
            <input type="radio" name="change-source" value={d.id} checked={choice === d.id} onChange={() => setChoice(d.id)} />
            <span>
              {d.date}
              {d.date > day.date ? ' (later day)' : ''}
              {d.session?.session_description ? ` — ${d.session.session_description}` : ''}
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}
