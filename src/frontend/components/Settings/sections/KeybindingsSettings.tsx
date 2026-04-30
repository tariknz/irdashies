import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type {
  KeybindingActionId,
  KeybindingEntry,
  KeybindingsMap,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';

/**
 * Maps a browser KeyboardEvent into an Electron accelerator string.
 * Returns null if only modifier keys are pressed (waiting for a main key).
 */
function keyEventToAccelerator(e: KeyboardEvent): string | null {
  const parts: string[] = [];

  if (e.ctrlKey || e.metaKey) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');

  // Ignore standalone modifier presses
  if (['Control', 'Meta', 'Alt', 'Shift'].includes(e.key)) {
    return null;
  }

  const keyMap: Record<string, string> = {
    ' ': 'Space',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    '+': 'Plus',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Escape: 'Escape',
    Enter: 'Return',
    Tab: 'Tab',
    Backspace: 'Backspace',
  };

  let key = keyMap[e.key] ?? e.key;

  // Function keys are fine as-is (F1-F24)
  if (/^F\d{1,2}$/.test(key)) {
    // Already correct
  } else if (key.length === 1) {
    // Single character keys — uppercase for accelerator
    key = key.toUpperCase();
  }

  parts.push(key);
  return parts.join('+');
}

/**
 * Formats an accelerator string for display, e.g. "CommandOrControl" -> "Ctrl".
 */
function formatAccelerator(accelerator: string): string {
  const isMac =
    typeof navigator !== 'undefined' &&
    navigator.platform.toUpperCase().includes('MAC');

  return accelerator
    .split('+')
    .map((part) => {
      switch (part) {
        case 'CommandOrControl':
          return isMac ? 'Cmd' : 'Ctrl';
        case 'Control':
          return 'Ctrl';
        case 'Meta':
          return isMac ? 'Cmd' : 'Win';
        default:
          return part;
      }
    })
    .join(' + ');
}

interface KeyRecorderProps {
  actionId: KeybindingActionId;
  entry: KeybindingEntry;
  onUpdated: (bindings: KeybindingsMap) => void;
}

const KeyRecorder = ({ actionId, entry, onUpdated }: KeyRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<HTMLButtonElement>(null);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    await window.keybindingsBridge?.stopRecording();
  }, []);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = async (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels recording
      if (e.key === 'Escape') {
        await stopRecording();
        return;
      }

      const accelerator = keyEventToAccelerator(e);
      if (!accelerator) return; // Only modifiers pressed, keep waiting

      try {
        const result = await window.keybindingsBridge.updateKeybinding(
          actionId,
          accelerator
        );
        setError(null);
        onUpdated(result);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to set keybinding'
        );
      }
      await stopRecording();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [recording, actionId, onUpdated, stopRecording]);

  // Click outside cancels recording
  useEffect(() => {
    if (!recording) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        recorderRef.current &&
        !recorderRef.current.contains(e.target as Node)
      ) {
        stopRecording();
      }
    };

    // Delay so the click that started recording doesn't immediately cancel
    const timer = setTimeout(() => {
      window.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [recording, stopRecording]);

  const startRecording = async () => {
    setError(null);
    await window.keybindingsBridge?.startRecording();
    setRecording(true);
  };

  const handleReset = async () => {
    try {
      const result = await window.keybindingsBridge.resetKeybinding(actionId);
      setError(null);
      onUpdated(result);
    } catch (err) {
      logger.error('Failed to reset keybinding:', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        ref={recorderRef}
        type="button"
        onClick={recording ? undefined : startRecording}
        className={[
          'px-3 py-1.5 rounded text-sm font-mono min-w-[120px] text-center transition-all cursor-pointer',
          recording
            ? 'bg-blue-600/30 border border-blue-400 text-blue-300 animate-pulse'
            : 'bg-slate-700 border border-slate-600 text-white hover:bg-slate-600',
        ].join(' ')}
      >
        {recording ? 'Press keys...' : formatAccelerator(entry.accelerator)}
      </button>
      {!entry.isDefault && (
        <button
          type="button"
          onClick={handleReset}
          className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          title="Reset to default"
        >
          <ArrowCounterClockwiseIcon size={14} />
        </button>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
};

export const KeybindingsSettings = () => {
  const [bindings, setBindings] = useState<KeybindingsMap | null>(null);

  useEffect(() => {
    window.keybindingsBridge?.getKeybindings().then(setBindings);
  }, []);

  const handleResetAll = async () => {
    try {
      const result = await window.keybindingsBridge.resetAllKeybindings();
      setBindings(result);
    } catch (err) {
      logger.error('Failed to reset all keybindings:', err);
    }
  };

  if (!bindings) {
    return <>Loading...</>;
  }

  const actionIds = Object.keys(bindings) as KeybindingActionId[];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 bg-slate-700 rounded">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl mb-1">Key Bindings</h2>
            <p className="text-slate-400 text-sm">
              Customize keyboard shortcuts. Click a binding then press a new key
              combination.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-xs text-slate-300 hover:text-white bg-slate-600 hover:bg-slate-500 rounded px-3 py-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            Reset All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 mt-4">
        <div className="flex flex-col gap-1">
          {actionIds.map((actionId) => {
            const entry = bindings[actionId];
            return (
              <div
                key={actionId}
                className="flex items-center justify-between px-4 py-3 rounded bg-slate-700/50 hover:bg-slate-700/70 transition-colors"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-white">
                    {entry.label}
                  </span>
                  <span className="text-xs text-slate-400">
                    {entry.description}
                  </span>
                </div>
                <KeyRecorder
                  actionId={actionId}
                  entry={entry}
                  onUpdated={setBindings}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
