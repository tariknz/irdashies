import type { ChromiumFlagsType } from '@irdashies/types';
import { DEFAULT_CHROMIUM_FLAGS } from '@irdashies/types';
import logger from '../logger';
import { readData, writeData } from './storage';

const STORAGE_KEY = 'chromiumFlags';

const ANGLE_BACKENDS: ReadonlySet<
  NonNullable<ChromiumFlagsType['angleBackend']>
> = new Set(['default', 'gl', 'd3d11', 'd3d9', 'metal', 'vulkan']);

/**
 * Allowlist of Chromium switch names accepted in the `customSwitches` field.
 *
 * Anything outside this set is silently dropped at save/load time with a
 * warning logged. The list is intentionally narrow and focused on GPU,
 * rendering, scaling, and power switches that have a legitimate diagnostic
 * use. Switches that affect network behaviour, debugger exposure, JS engine
 * tuning, Chrome extensions, profile directories, or the same-origin policy
 * are deliberately excluded — they are the renderer-compromise attack surface
 * called out as finding S1 in docs/ARCHITECTURE_REVIEW.md.
 *
 * Add entries to this list only after confirming the switch cannot be abused
 * to weaken the security posture of the app on next launch.
 */
const CUSTOM_SWITCH_ALLOWLIST: ReadonlySet<string> = new Set([
  // GPU control
  'use-gl',
  'use-angle',
  'disable-gpu',
  'disable-gpu-compositing',
  'disable-gpu-driver-bug-workarounds',
  'disable-software-rasterizer',
  'ignore-gpu-blocklist',
  'ignore-gpu-blacklist', // deprecated alias still accepted by Chromium
  // Rasterization
  'enable-gpu-rasterization',
  'disable-gpu-rasterization',
  'force-gpu-rasterization',
  'enable-zero-copy',
  'disable-zero-copy',
  // VSync / frame rate
  'disable-gpu-vsync',
  'disable-frame-rate-limit',
  // Color / scaling
  'force-color-profile',
  'force-device-scale-factor',
  'high-dpi-support',
  // Compositing
  'disable-direct-composition',
  // Locale
  'lang',
  // Power / backgrounding
  'disable-renderer-backgrounding',
  'disable-background-timer-throttling',
  'disable-backgrounding-occluded-windows',
  // High-performance hints (both syntaxes seen in the wild)
  'force_high_performance_gpu',
  'force-high-performance-gpu',
  // Safe diagnostic logging
  'enable-logging',
  'log-level',
  'v',
  'vmodule',
]);

export interface CustomSwitchEntry {
  name: string;
  value?: string;
}

/**
 * Parses the freeform `customSwitches` text into structured entries.
 *
 * Each non-empty, non-comment line is `switch-name` or `switch-name=value`.
 * A leading `--` is tolerated and stripped. Blank lines and lines starting
 * with `#` are ignored. This is the single source of truth for the parse —
 * both storage filtering and overlayManager application route through here.
 */
export function parseCustomSwitches(text: string): CustomSwitchEntry[] {
  if (!text) return [];
  const entries: CustomSwitchEntry[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim().replace(/^--/, '');
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) {
      entries.push({ name: line });
    } else {
      const name = line.slice(0, eq).trim();
      const value = line.slice(eq + 1).trim();
      if (name) entries.push({ name, value });
    }
  }
  return entries;
}

/**
 * Filters the freeform `customSwitches` text against the allowlist. Returns
 * the sanitized string (only allowed entries, one per line) and the list of
 * dropped switch names. Caller is expected to log the dropped names.
 *
 * Comments are deliberately not preserved: the persisted form is the result
 * of a save round-trip, and round-tripping is expected to normalise. Users
 * can still write comments — they are stripped only at save time, not from
 * the UI form state.
 */
export function filterCustomSwitches(text: string): {
  sanitized: string;
  dropped: string[];
} {
  const entries = parseCustomSwitches(text);
  const kept: CustomSwitchEntry[] = [];
  const dropped: string[] = [];
  for (const entry of entries) {
    if (CUSTOM_SWITCH_ALLOWLIST.has(entry.name)) {
      kept.push(entry);
    } else {
      dropped.push(entry.name);
    }
  }
  const sanitized = kept
    .map((e) => (e.value === undefined ? e.name : `${e.name}=${e.value}`))
    .join('\n');
  return { sanitized, dropped };
}

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

  const rawCustomSwitches =
    typeof src.customSwitches === 'string' ? src.customSwitches : '';
  const { sanitized: customSwitches, dropped } =
    filterCustomSwitches(rawCustomSwitches);
  if (dropped.length > 0) {
    logger.warn(
      '[chromiumFlags] Dropped custom switches not in allowlist:',
      dropped
    );
  }

  return {
    disableNativeWinOcclusion: src.disableNativeWinOcclusion === true,
    angleBackend,
    disableDirectComposition: src.disableDirectComposition === true,
    disableFeatures: toStringArray(src.disableFeatures),
    enableFeatures: toStringArray(src.enableFeatures),
    customSwitches,
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
