import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { DEFAULT_KEYBINDINGS } from '@irdashies/types';
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
  for (const key of Object.keys(merged) as KeybindingActionId[]) {
    if (stored[key]) {
      merged[key] = stored[key];
    }
  }
  return merged;
}

export function saveKeybindings(bindings: KeybindingsMap): void {
  writeData(STORAGE_KEY, bindings);
}

export function updateKeybinding(
  actionId: KeybindingActionId,
  accelerator: string
): KeybindingsMap {
  const bindings = getKeybindings();

  // Check for conflicts
  for (const [id, entry] of Object.entries(bindings)) {
    if (id !== actionId && entry.accelerator === accelerator) {
      throw new Error(
        `Accelerator "${accelerator}" is already bound to "${entry.label}"`
      );
    }
  }

  bindings[actionId] = {
    ...bindings[actionId],
    accelerator,
    isDefault: accelerator === DEFAULT_KEYBINDINGS[actionId].accelerator,
  };
  saveKeybindings(bindings);
  return bindings;
}

export function resetKeybinding(actionId: KeybindingActionId): KeybindingsMap {
  const bindings = getKeybindings();
  bindings[actionId] = { ...DEFAULT_KEYBINDINGS[actionId] };
  saveKeybindings(bindings);
  return bindings;
}

export function resetAllKeybindings(): KeybindingsMap {
  const bindings = { ...DEFAULT_KEYBINDINGS };
  saveKeybindings(bindings);
  return bindings;
}
