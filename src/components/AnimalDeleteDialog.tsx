import { useId, useState, useEffect } from 'react';
import Modal from './Modal/Modal';
import { getAnimalDeleteCascade, DOWNSTREAM_NOT_DELETED_NOTE } from '../domain/animalDeleteCascade';
import type { Animal, Day } from '../state/workspaceTypes';
import './AnimalDeleteDialog.css';

interface AnimalDeleteDialogProps {
  /** Whether the dialog is shown. */
  isOpen: boolean;
  /** The animal's store key (the value the user must type). */
  animalId?: string;
  /** The animal record (for the cascade). */
  animal?: Animal;
  /** The workspace day map (for the cascade). */
  days?: Record<string, Day>;
  /** Called when the user confirms with a matching typed name. */
  onConfirm: () => void;
  /** Called for cancel / ESC. */
  onCancel: () => void;
}

/**
 * AnimalDeleteDialog — the destructive, type-to-confirm animal-delete dialog (Phase 4, Tasks
 * 4.1/4.1a).
 *
 * Deleting an animal is the app's only irreversible, whole-animal-wiping action — it removes the
 * animal's shared setup AND every recording day it owns at once — so the Delete button stays
 * disabled until the user types the animal's id exactly (trimmed). It states the honest cascade
 * (deletable day count, preserved wrong-owner records, surviving recovered records, and the
 * downloaded-artifacts caveat) from {@link getAnimalDeleteCascade}, so the same copy is shown
 * wherever animal-delete is triggered (the picker ⋮ and the header ⋮). Built on the shared Modal
 * (focus trap, ESC, focus return); the typed field is the first focusable, so focus opens on it.
 *
 */
export default function AnimalDeleteDialog({
  isOpen,
  animalId,
  animal,
  days,
  onConfirm,
  onCancel,
}: AnimalDeleteDialogProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const messageId = `${baseId}-message`;
  const fieldId = `${baseId}-field`;
  const [typed, setTyped] = useState('');

  // Clear the typed gate whenever the dialog (re)opens, so a prior attempt never carries over.
  useEffect(() => {
    if (isOpen) setTyped('');
  }, [isOpen]);

  if (!isOpen) return null;

  const cascade = getAnimalDeleteCascade(
    animalId as string,
    animal as Animal,
    days as Record<string, Day>
  );
  const matches = typed.trim() === String(animalId ?? '').trim();

  const handleConfirm = () => {
    if (matches) onConfirm();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Delete animal?"
      titleId={titleId}
      role="alertdialog"
      // A destructive, type-gated choice must be made deliberately — a stray backdrop click can't
      // dismiss it (ESC / Cancel still close).
      closeOnOverlayClick={false}
      describedById={messageId}
      className="confirm-dialog animal-delete-dialog"
    >
      <p id={messageId} className="confirm-dialog-message">
        Delete <strong>{animalId}</strong> and its {cascade.ownedDayCount}{' '}
        {cascade.ownedDayCount === 1 ? 'recording day' : 'recording days'}? This removes the animal
        and the recording days it owns from this workspace and from export lists.
        {cascade.wrongOwnerCount > 0 &&
          ` ${cascade.wrongOwnerCount} day ${
            cascade.wrongOwnerCount === 1 ? 'record' : 'records'
          } listed here by mistake (belonging to another animal) will be preserved.`}
        {cascade.orphanCount > 0 &&
          ` ${cascade.orphanCount} recovered day ${
            cascade.orphanCount === 1 ? 'record' : 'records'
          } not in this animal's day list will remain in the workspace (resolve them from the validation summary).`}
        {cascade.hasArtifacts && DOWNSTREAM_NOT_DELETED_NOTE} This cannot be undone.
      </p>

      <div className="animal-delete-confirm-field">
        <label htmlFor={fieldId}>
          Type <strong className="animal-delete-confirm-name">{animalId}</strong> to confirm:
        </label>
        <input
          id={fieldId}
          type="text"
          value={typed}
          autoComplete="off"
          placeholder="Type the animal ID to confirm"
          onChange={(e) => setTyped(e.target.value)}
          // Enter submits when the name matches, mirroring a normal confirm.
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleConfirm();
          }}
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn-cancel" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="button"
          className="btn-danger"
          disabled={!matches}
          // Names why it's disabled for assistive tech until the typed name matches.
          aria-describedby={matches ? undefined : messageId}
          onClick={handleConfirm}
        >
          Delete animal
        </button>
      </div>
    </Modal>
  );
}

