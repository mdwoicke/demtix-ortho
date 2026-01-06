/**
 * ConfirmationModal Component
 * Professional confirmation dialog with warning styling for critical actions
 */

import { Modal } from './Modal';
import { Button } from './Button';

export type ConfirmationVariant = 'warning' | 'danger' | 'info';

export interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmationVariant;
  isLoading?: boolean;
}

const variantStyles: Record<ConfirmationVariant, {
  icon: React.ReactNode;
  iconBg: string;
  confirmButton: string;
}> = {
  warning: {
    icon: (
      <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    confirmButton: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500',
  },
  danger: {
    icon: (
      <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  },
  info: {
    icon: (
      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
  },
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning',
  isLoading = false,
}: ConfirmationModalProps) {
  const styles = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      showCloseButton={false}
      closeOnBackdrop={!isLoading}
    >
      <div className="flex flex-col items-center text-center">
        {/* Icon */}
        <div className={`w-16 h-16 rounded-full ${styles.iconBg} flex items-center justify-center mb-4`}>
          {styles.icon}
        </div>

        {/* Title */}
        <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h3>

        {/* Message */}
        <div className="text-gray-600 dark:text-gray-400 mb-6">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 w-full">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <button
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex-1 px-4 py-2 text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${styles.confirmButton}`}
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Processing...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
