import { useEffect, useRef } from 'react';

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
    variant = 'danger'
}: ConfirmDialogProps) => {
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const cancelButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isOpen) {
            // Focus the cancel button by default for destructive actions
            setTimeout(() => {
                if (variant === 'danger') {
                    cancelButtonRef.current?.focus();
                } else {
                    confirmButtonRef.current?.focus();
                }
            }, 100);
        }
    }, [isOpen, variant]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                onCancel();
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
            confirmButton: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
            icon: '⚠️'
        },
        warning: {
            confirmButton: 'bg-yellow-600 hover:bg-yellow-700 focus:ring-yellow-500',
            icon: '⚠️'
        },
        info: {
            confirmButton: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
            icon: 'ℹ️'
        }
    };

    const styles = variantStyles[variant];

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50 transition-opacity duration-200"
                onClick={onCancel}
            />

            {/* Dialog */}
            <div
                className={`relative bg-slate-800 rounded-lg shadow-xl max-w-md w-full mx-4 transform transition-transform duration-200 ${isOpen ? 'scale-100' : 'scale-95'
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6">
                    {/* Header */}
                    <div className="flex items-center mb-4">
                        <span className="text-2xl mr-3">{styles.icon}</span>
                        <h3 className="text-lg font-semibold text-white">
                            {title}
                        </h3>
                    </div>

                    {/* Content */}
                    <div className="mb-6">
                        <p className="text-gray-300 leading-relaxed">
                            {message}
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3">
                        <button
                            ref={cancelButtonRef}
                            onClick={onCancel}
                            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors"
                        >
                            {cancelText}
                        </button>
                        <button
                            ref={confirmButtonRef}
                            onClick={onConfirm}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-800 transition-colors ${styles.confirmButton}`}
                        >
                            {confirmText}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};