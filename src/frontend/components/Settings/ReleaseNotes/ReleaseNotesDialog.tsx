import { useEffect, useRef } from 'react';
import { XIcon } from '@phosphor-icons/react';
import type { ReleaseNotesPanelState } from './ReleaseNotesPanel';
import { ReleaseNotesPanel } from './ReleaseNotesPanel';

export interface ReleaseNotesDialogProps {
  version: string;
  state: ReleaseNotesPanelState;
  onClose: () => void;
  onRetry?: () => void;
  preview?: boolean;
}

export const ReleaseNotesDialog = ({
  version,
  state,
  onClose,
  onRetry,
  preview,
}: ReleaseNotesDialogProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  // Native modal dialog supplies keyboard focus trapping and inert background.
  return (
    <dialog
      ref={dialog}
      aria-labelledby="release-notes-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto [-webkit-app-region:no-drag] w-[min(48rem,90vw)] max-h-[85vh] rounded-lg border border-slate-600 bg-slate-800 p-0 text-white shadow-xl backdrop:bg-black/60"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-600 px-6 py-4">
        <h2 id="release-notes-title" className="text-xl font-bold">
          {preview ? 'Release notes preview' : `What's new in v${version}`}
        </h2>
        <button
          autoFocus
          onClick={onClose}
          aria-label="Close release notes"
          className="rounded p-1 text-slate-300 hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-accent-300"
        >
          <XIcon size={24} />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-6">
        <ReleaseNotesPanel version={version} state={state} onRetry={onRetry} />
      </div>
      <div className="flex justify-end border-t border-slate-600 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded bg-slate-600 px-4 py-2 hover:bg-slate-500"
        >
          Done
        </button>
      </div>
    </dialog>
  );
};
