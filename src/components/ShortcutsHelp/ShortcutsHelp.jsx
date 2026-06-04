import React, { useId } from 'react';
import PropTypes from 'prop-types';
import Modal from '../Modal/Modal';
import './ShortcutsHelp.scss';

/**
 * The keyboard shortcuts surfaced by {@link useGlobalShortcuts}, shown in the help
 * dialog and discoverable via the header trigger and the `?` shortcut.
 */
export const SHORTCUTS = [
  { keys: ['Ctrl/Cmd', 'S'], action: 'Save your work' },
  { keys: ['Alt', '→'], action: 'Next step' },
  { keys: ['Alt', '←'], action: 'Previous step' },
  { keys: ['Alt', 'N'], action: 'Add a row (e.g. an epoch on the Epochs step)' },
  { keys: ['?'], action: 'Show this help' },
  { keys: ['Esc'], action: 'Close a dialog' },
];

/**
 * Keyboard-shortcuts help dialog, built on the shared accessible `<Modal>`.
 *
 * @param {object} props
 * @param {boolean} props.isOpen - Whether the dialog is shown.
 * @param {() => void} props.onClose - Close handler (Esc / overlay / button).
 * @returns {JSX.Element|null}
 */
export default function ShortcutsHelp({ isOpen, onClose }) {
  const baseId = useId();
  const titleId = `${baseId}-title`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Keyboard shortcuts" titleId={titleId} className="shortcuts-help">
      <table className="shortcuts-help-table">
        <thead>
          <tr>
            <th scope="col">Shortcut</th>
            <th scope="col">Action</th>
          </tr>
        </thead>
        <tbody>
          {SHORTCUTS.map((s) => (
            <tr key={s.action}>
              <td>
                {s.keys.map((k, i) => (
                  <React.Fragment key={k}>
                    {i > 0 && <span className="shortcut-plus" aria-hidden="true"> + </span>}
                    <kbd>{k}</kbd>
                  </React.Fragment>
                ))}
              </td>
              <td>{s.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

ShortcutsHelp.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};
