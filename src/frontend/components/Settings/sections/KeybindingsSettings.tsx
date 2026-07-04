import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwiseIcon } from '@phosphor-icons/react';
import type {
  KeybindingActionId,
  KeybindingEntry,
  KeybindingsMap,
} from '@irdashies/types';
import {
  isGamepadBinding,
  isWidgetToggleActionId,
  parseGamepadToken,
  parseGamepadTokens,
  widgetToggleActionId,
} from '@irdashies/shared';
import { useDashboard } from '@irdashies/context';
import logger from '@irdashies/utils/logger';
import { widgetItems, widgetLabel } from '../menuItems';

const HAT_DIRECTION_LABELS: Record<string, string> = {
  up: 'Up',
  upright: 'Up Right',
  right: 'Right',
  downright: 'Down Right',
  down: 'Down',
  downleft: 'Down Left',
  left: 'Left',
  upleft: 'Up Left',
};

/** Format a gamepad control id ("btn5", "hat0_up") into a human label. */
function formatGamepadControl(control: string): string {
  const button = /^btn(\d+)$/.exec(control);
  if (button) return `Button ${button[1]}`;

  const hat = /^hat(\d+)_([a-z]+)$/.exec(control);
  if (hat) {
    const label = HAT_DIRECTION_LABELS[hat[2]] ?? hat[2];
    // Hat 0 is the d-pad on every controller seen so far; name it as such.
    return hat[1] === '0' ? `D-pad ${label}` : `Hat ${hat[1]} ${label}`;
  }

  return control;
}

/**
 * Formats a gamepad token for display, prefixed with the device name when known
 * and falling back to "Pad" otherwise, e.g.
 *   "gamepad:Logitech%20G29:btn5" -> "Logitech G29: Button 5"
 *   "gamepad:btn5"                -> "Pad: Button 5"
 *   "gamepad:hat0_up"             -> "Pad: D-pad Up"
 */
function formatGamepadToken(token: string): string {
  const parsed = parseGamepadToken(token);
  if (!parsed) return 'Pad: ?';

  const prefix = parsed.device || 'Pad';
  return `${prefix}: ${formatGamepadControl(parsed.button)}`;
}

// Every modifier KeyboardEvent.key value (W3C UI Events). A bare modifier press
// can't be a main key, and none are valid standalone Electron accelerators.
const MODIFIER_KEYS = new Set([
  'Alt',
  'AltGraph',
  'CapsLock',
  'Control',
  'Fn',
  'FnLock',
  'Hyper',
  'Meta',
  'NumLock',
  'ScrollLock',
  'Shift',
  'Super',
  'Symbol',
  'SymbolLock',
]);

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
  if (MODIFIER_KEYS.has(e.key)) {
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
 * A gamepad combo (chord) renders each button joined by " + ", e.g.
 * "Pad: Button 0 + Pad: Button 5".
 */
function formatAccelerator(accelerator: string): string {
  if (isGamepadBinding(accelerator)) {
    const tokens = parseGamepadTokens(accelerator);
    if (tokens) return tokens.map(formatGamepadToken).join(' + ');
    return formatGamepadToken(accelerator);
  }

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
  // First input (key or pad) during recording wins; later ones are ignored until
  // recording restarts. Guards the async gap before listeners are torn down.
  const bindingInProgressRef = useRef(false);
  // Read the latest label/description at bind time without re-running the
  // recording effect when the (possibly freshly-synthesized) entry changes.
  const entryRef = useRef(entry);
  useEffect(() => {
    entryRef.current = entry;
  }, [entry]);

  const stopRecording = useCallback(async () => {
    setRecording(false);
    bindingInProgressRef.current = false;
    await window.keybindingsBridge?.stopRecording();
  }, []);

  useEffect(() => {
    if (!recording) return;

    // Persist whichever input arrives first — a key combo or a controller button.
    const applyBinding = async (accelerator: string) => {
      // check-then-set is atomic (no await between); blocks a second concurrent input.
      if (bindingInProgressRef.current) return;
      bindingInProgressRef.current = true;
      try {
        const result = await window.keybindingsBridge.updateKeybinding(
          actionId,
          accelerator,
          {
            label: entryRef.current.label,
            description: entryRef.current.description,
          }
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

      await applyBinding(accelerator);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    // Controllers have no focus/DOM events; the main process captures pad
    // presses via the WebHID host and forwards the token here while recording.
    const unsubscribeGamepad = window.keybindingsBridge?.onGamepadCaptured(
      (token) => {
        void applyBinding(token);
      }
    );

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      unsubscribeGamepad?.();
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
        {recording
          ? 'Press keys...'
          : entry.accelerator
            ? formatAccelerator(entry.accelerator)
            : 'Not set'}
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

interface BindingRowProps {
  actionId: KeybindingActionId;
  entry: KeybindingEntry;
  onUpdated: (bindings: KeybindingsMap) => void;
}

const BindingRow = ({ actionId, entry, onUpdated }: BindingRowProps) => (
  <div className="flex items-center justify-between px-4 py-3 rounded bg-slate-700/50 hover:bg-slate-700/70 transition-colors">
    <div className="flex flex-col gap-0.5">
      <span className="text-sm font-medium text-white">{entry.label}</span>
      <span className="text-xs text-slate-400">{entry.description}</span>
    </div>
    <KeyRecorder actionId={actionId} entry={entry} onUpdated={onUpdated} />
  </div>
);

export const KeybindingsSettings = () => {
  const [bindings, setBindings] = useState<KeybindingsMap | null>(null);
  const { currentDashboard } = useDashboard();

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

  // The stored map may also contain dynamic widget toggles; the static section
  // only shows the fixed app-level actions.
  const staticActionIds = (
    Object.keys(bindings) as KeybindingActionId[]
  ).filter((id) => !isWidgetToggleActionId(id));

  // One bindable show/hide toggle per widget instance in the current dashboard.
  // Derived live, so newly-added widgets automatically appear with no defaults.
  // Ordered to match the settings menu (widgetItems); unknown types sort last.
  const menuOrder = (widget: { type?: string; id: string }) => {
    const index = widgetItems.findIndex(
      (item) => item.widgetType === (widget.type ?? widget.id)
    );
    return index === -1 ? widgetItems.length : index;
  };
  const widgets = [...(currentDashboard?.widgets ?? [])].sort(
    (a, b) => menuOrder(a) - menuOrder(b)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 bg-slate-700 rounded">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl mb-1">Key Bindings</h2>
            <p className="text-slate-400 text-sm">
              Customize keyboard shortcuts. Click a binding then press a new key
              combination, or hold two or more controller buttons together for a
              combo.
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
          {staticActionIds.map((actionId) => (
            <BindingRow
              key={actionId}
              actionId={actionId}
              entry={bindings[actionId]}
              onUpdated={setBindings}
            />
          ))}
        </div>

        {widgets.length > 0 && (
          <>
            <h3 className="text-sm font-semibold text-slate-300 mt-6 mb-2 px-1">
              Widget Visibility
            </h3>
            <p className="text-xs text-slate-400 mb-2 px-1">
              Assign a key or controller button to show / hide an individual
              widget. Unbound by default.
            </p>
            <div className="flex flex-col gap-1">
              {widgets.map((widget) => {
                const actionId = widgetToggleActionId(widget.id);
                const label = widgetLabel(widget.type ?? widget.id);
                const entry: KeybindingEntry = bindings[actionId] ?? {
                  accelerator: '',
                  label,
                  description: `Show / hide the ${label} widget`,
                  isDefault: true,
                };
                return (
                  <BindingRow
                    key={actionId}
                    actionId={actionId}
                    entry={entry}
                    onUpdated={setBindings}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
