import type { ChromiumFlagsType } from '@irdashies/types';
import { DEFAULT_CHROMIUM_FLAGS } from '@irdashies/types';
import { readData, writeData } from './storage';

const STORAGE_KEY = 'chromiumFlags';

const ANGLE_BACKENDS: ReadonlySet<
  NonNullable<ChromiumFlagsType['angleBackend']>
> = new Set(['default', 'gl', 'd3d11', 'd3d9', 'metal', 'vulkan']);

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter(Boolean);
}

function normalizeFlags(input: unknown): ChromiumFlagsType {
  const src = (input && typeof input === 'object' ? input : {}) as Record<
    string,
    unknown
  >;
  const angleBackend = ANGLE_BACKENDS.has(
    src.angleBackend as NonNullable<ChromiumFlagsType['angleBackend']>
  )
    ? (src.angleBackend as ChromiumFlagsType['angleBackend'])
    : 'default';

  return {
    disableNativeWinOcclusion: src.disableNativeWinOcclusion === true,
    angleBackend,
    disableDirectComposition: src.disableDirectComposition === true,
    disableFeatures: toStringArray(src.disableFeatures),
    enableFeatures: toStringArray(src.enableFeatures),
    customSwitches:
      typeof src.customSwitches === 'string' ? src.customSwitches : '',
  };
}

export function getChromiumFlags(): ChromiumFlagsType {
  const stored = readData<unknown>(STORAGE_KEY);
  return { ...DEFAULT_CHROMIUM_FLAGS, ...normalizeFlags(stored) };
}

export function saveChromiumFlags(flags: ChromiumFlagsType): ChromiumFlagsType {
  const merged = { ...DEFAULT_CHROMIUM_FLAGS, ...normalizeFlags(flags) };
  writeData(STORAGE_KEY, merged);
  return merged;
}
