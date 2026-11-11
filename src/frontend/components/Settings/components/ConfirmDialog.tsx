import { useEffect, useId, useRef } from 'react';
import { TrashIcon } from '@phosphor-icons/react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning' | 'info';
}

export const ConfirmDialog = ({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'danger',
}: ConfirmDialogProps) => {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const messageId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const opener = document.activeElement;
    const fallback = rootRef.current?.closest<HTMLElement>('main');
    const background: { element: HTMLElement; inert: string | null }[] = [];
    // Make every sibling along the ancestor chain inert, preserving existing
    // inert state. This covers both nested settings and portalled dialogs.
    let branch: HTMLElement | null = rootRef.current;
    while (branch?.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          background.push({
            element: sibling,
            inert: sibling.getAttribute('inert'),
          });
          sibling.setAttribute('inert', '');
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    (variant === 'danger'
      ? cancelButtonRef
      : confirmButtonRef
    ).current?.focus();

    return () => {
      for (const { element, inert } of background) {
        if (inert === null) element.removeAttribute('inert');
        else element.setAttribute('inert', inert);
      }
      if (
        opener instanceof HTMLElement &&
        opener.isConnected &&
        !opener.matches(':disabled') &&
        !opener.closest('[inert]')
      )
        opener.focus();
      else fallback?.focus();
    };
  }, [isOpen, variant]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>(
          'button:not(:disabled)'
        );
        const first = buttons?.[0];
        const last = buttons?.[buttons.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          last?.focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === last ||
            !dialogRef.current?.contains(document.activeElement))
        ) {
          e.preventDefault();
          first?.focus();
        }
      } else if (e.key === 'Enter' && e.ctrlKey) {
        onConfirm();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onConfirm, onCancel]);

  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      confirmButton:
        'border border-red-400 bg-red-950/40 hover:bg-red-950/70 focus:ring-red-400 text-red-200',
      icon: '',
    },
    warning: {
      confirmButton:
        'border border-amber-400 bg-amber-950/40 hover:bg-amber-950/70 focus:ring-amber-400 text-amber-200',
      icon: '',
    },
    info: {
      confirmButton:
        'bg-accent-600 hover:bg-accent-700 focus:ring-accent-500 text-on-accent',
      icon: '',
    },
  };

  const styles = variantStyles[variant];

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-50 [-webkit-app-region:no-drag] flex items-center justify-center p-4 transition-opacity duration-200 ${
        isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 transition-opacity duration-200"
        onClick={onCancel}
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-describedby={messageId}
        className={`relative bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-transform duration-200 ${
          isOpen ? 'scale-100' : 'scale-95'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center mb-4">
            {styles.icon && (
              <span className="text-2xl mr-3">{styles.icon}</span>
            )}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>

          {/* Content */}
          <div className="mb-6">
            <p id={messageId} className="text-slate-300 leading-relaxed">
              {message}
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              ref={cancelButtonRef}
              onClick={onCancel}
              className="settings-button"
            >
              {cancelText}
            </button>
            <button
              ref={confirmButtonRef}
              onClick={onConfirm}
              className={`inline-flex min-h-9 items-center gap-2 px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors ${styles.confirmButton}`}
            >
              {variant === 'danger' && (
                <TrashIcon size={16} aria-hidden="true" />
              )}
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
