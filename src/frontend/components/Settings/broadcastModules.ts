import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastTransition } from '@irdashies/types';
import { TRANSITIONS } from '@irdashies/domain/broadcast/towerPages';
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

const DEFAULT_TRANSITION: BroadcastTransition =
  getWidgetDefaultConfig('broadcast').pageTransition;

const isBroadcastTransition = (value: unknown): value is BroadcastTransition =>
  value === 'random' || TRANSITIONS.some((transition) => transition === value);

// One transition for every module. It is kept in the tower config, where it
// started out, so saved dashboards need no migration.
export const broadcastTransition = (
  towerConfig: unknown
): BroadcastTransition => {
  const value = (towerConfig as { pageTransition?: unknown } | undefined)
    ?.pageTransition;
  return isBroadcastTransition(value) ? value : DEFAULT_TRANSITION;
};

export const broadcastTransitionChanged = (towerConfig: unknown): boolean =>
  broadcastTransition(towerConfig) !== DEFAULT_TRANSITION;
