import { getWidgetDefaultConfig } from '@irdashies/types';
import { differsFromDefault } from './components/ChangedMark';

export const BROADCAST_MODULE_TYPES = [
  'broadcast',
  'broadcastticker',
  'broadcastevents',
  'broadcastweather',
  'broadcastpodium',
] as const;

export type BroadcastModuleType = (typeof BROADCAST_MODULE_TYPES)[number];

export const isBroadcastModuleType = (
  type: string | undefined
): type is BroadcastModuleType =>
  (BROADCAST_MODULE_TYPES as readonly string[]).includes(type ?? '');

/**
 * A module's defaults. The tower's also hold the shared transition, which
 * belongs to every module, so a tower reset leaves it alone.
 */
export const broadcastModuleDefaults = (
  type: BroadcastModuleType
): Record<string, unknown> => {
  const defaults: Record<string, unknown> = { ...getWidgetDefaultConfig(type) };
  if (type === 'broadcast') delete defaults.pageTransition;
  return defaults;
};

export const broadcastModuleChanged = (
  type: BroadcastModuleType,
  config: unknown
): boolean => differsFromDefault(config, broadcastModuleDefaults(type));
