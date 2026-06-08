import React, { useState } from 'react';
import AlertModal from '../../../components/AlertModal';

/**
 * In-app feedback (replacing native `alert()`) for the animal-setup containers: a `showAlert`
 * dispatcher plus the `AlertModal` element to render. Each container instantiates its own so an
 * alert it raises (e.g. "created N groups", a CSV import result) is scoped to that container and
 * not duplicated across sections.
 *
 * @returns {{ showAlert: Function, alertElement: JSX.Element }}
 */
export function useAnimalAlert() {
  const [alertState, setAlertState] = useState({
    isOpen: false,
    message: '',
    type: 'info',
    title: 'Alert',
    onClose: null,
  });

  /**
   * Show a non-blocking alert. Optional `onClose` runs after the user dismisses it.
   * @param {string} message - Message to display.
   * @param {('info'|'success'|'warning'|'error')} [type] - Alert type.
   * @param {Function|null} [onClose] - Optional action to run on dismiss.
   * @param {string} [title] - Dialog title (defaults to a sensible label per type).
   */
  const showAlert = (message, type = 'success', onClose = null, title) => {
    const defaultTitle =
      { success: 'Success', error: 'Error', warning: 'Warning', info: 'Notice' }[type] || 'Notice';
    setAlertState({ isOpen: true, message, type, title: title || defaultTitle, onClose });
  };

  // Read the deferred action, close, THEN run it — never a side effect inside the state updater.
  const handleAlertClose = () => {
    const deferred = alertState.onClose;
    setAlertState((prev) => ({ ...prev, isOpen: false }));
    if (deferred) deferred();
  };

  const alertElement = (
    <AlertModal
      isOpen={alertState.isOpen}
      message={alertState.message}
      title={alertState.title}
      type={alertState.type}
      onClose={handleAlertClose}
    />
  );

  return { showAlert, alertElement };
}
