import { useState } from 'react';
import AlertModal from '../../../components/AlertModal';

type AlertType = 'info' | 'success' | 'warning' | 'error';

interface AlertState {
  isOpen: boolean;
  message: string;
  type: AlertType;
  title: string;
  onClose: (() => void) | null;
}

/**
 * In-app feedback (replacing native `alert()`) for the animal-setup containers: a `showAlert`
 * dispatcher plus the `AlertModal` element to render. Each container instantiates its own so an
 * alert it raises (e.g. "created N groups", a CSV import result) is scoped to that container and
 * not duplicated across sections.
 *
 * @returns The alert dispatcher and the `AlertModal` element to render.
 */
export function useAnimalAlert() {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
    type: 'info',
    title: 'Alert',
    onClose: null,
  });

  /** Show a non-blocking alert. Optional `onClose` runs after the user dismisses it. */
  const showAlert = (message: string, type: AlertType = 'success', onClose: (() => void) | null = null, title?: string) => {
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
