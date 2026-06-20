import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
import { isWidgetToggleActionId } from '@irdashies/shared';
import { readData, writeData } from './storage';

const STORAGE_KEY = 'keybindings';

export function getKeybindings(): KeybindingsMap {
  const stored = readData<Partial<KeybindingsMap>>(STORAGE_KEY);
  if (!stored) {
    writeData(STORAGE_KEY, DEFAULT_KEYBINDINGS);
    return { ...DEFAULT_KEYBINDINGS };
  }

  // Merge with defaults so new actions added in future versions are included
  const merged: KeybindingsMap = { ...DEFAULT_KEYBINDINGS };
  for (const key of Object.keys(stored) as KeybindingActionId[]) {
    const entry = stored[key];
    if (!entry) continue;
    // Keep stored overrides of known static actions, plus any dynamic
    // per-widget toggles (which have no factory default to merge against).
    if (key in merged || isWidgetToggleActionId(key)) {
      merged[key] = entry;
    }
  }
  return merged;
}

export function saveKeybindings(bindings: KeybindingsMap): void {
  writeData(STORAGE_KEY, bindings);
}

export function updateKeybinding(
  actionId: KeybindingActionId,
  accelerator: string,
  meta?: { label: string; description: string }
): KeybindingsMap {
  const bindings = getKeybindings();

  // Check for conflicts (an empty accelerator means "unbound" — never conflicts)
  if (accelerator) {
    for (const [id, entry] of Object.entries(bindings)) {
      if (id !== actionId && entry.accelerator === accelerator) {
        throw new Error(
          `Accelerator "${accelerator}" is already bound to "${entry.label}"`
        );
      }
    }
  }

  const factory =
    DEFAULT_KEYBINDINGS[actionId as keyof typeof DEFAULT_KEYBINDINGS];

  // Dynamic (widget) bindings have no factory default: unbinding removes the
  // entry entirely so storage doesn't accumulate empty bindings.
  if (!factory && !accelerator) {
    return removeBinding(bindings, actionId);
  }

  const existing = bindings[actionId];
  bindings[actionId] = {
    accelerator,
    label: existing?.label ?? meta?.label ?? actionId,
    description: existing?.description ?? meta?.description ?? '',
    // For static actions, "default" means the factory accelerator. For dynamic
    // actions there is no factory binding, so unbound (empty) is the default.
    isDefault: factory
      ? accelerator === factory.accelerator
      : accelerator === '',
  };
  saveKeybindings(bindings);
  return bindings;
}

export function resetKeybinding(actionId: KeybindingActionId): KeybindingsMap {
  const bindings = getKeybindings();
  const factory =
    DEFAULT_KEYBINDINGS[actionId as keyof typeof DEFAULT_KEYBINDINGS];
  if (!factory) {
    // Dynamic action: resetting means unbinding (no factory binding exists).
    return removeBinding(bindings, actionId);
  }
  bindings[actionId] = { ...factory };
  saveKeybindings(bindings);
  return bindings;
}

/** Persist and return `bindings` with `actionId` removed. */
function removeBinding(
  bindings: KeybindingsMap,
  actionId: KeybindingActionId
): KeybindingsMap {
  const next = Object.fromEntries(
    Object.entries(bindings).filter(([id]) => id !== actionId)
  ) as KeybindingsMap;
  saveKeybindings(next);
  return next;
}

export function resetAllKeybindings(): KeybindingsMap {
  const bindings = { ...DEFAULT_KEYBINDINGS };
  saveKeybindings(bindings);
  return bindings;
}
