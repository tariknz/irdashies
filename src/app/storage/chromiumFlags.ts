import type { ChromiumFlagsType } from '@irdashies/types';
import { DEFAULT_CHROMIUM_FLAGS } from '@irdashies/types';
import { readData, writeData } from './storage';

const STORAGE_KEY = 'chromiumFlags';

export function getChromiumFlags(): ChromiumFlagsType {
  const stored = readData<ChromiumFlagsType>(STORAGE_KEY);
  if (!stored) {
    return { ...DEFAULT_CHROMIUM_FLAGS };
  }
  return { ...DEFAULT_CHROMIUM_FLAGS, ...stored };
}

export function saveChromiumFlags(flags: ChromiumFlagsType): ChromiumFlagsType {
  const merged = { ...DEFAULT_CHROMIUM_FLAGS, ...flags };
  writeData(STORAGE_KEY, merged);
  return merged;
}
