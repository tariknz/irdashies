import { useDashboard } from '@irdashies/context';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type DamageConfig,
} from '@irdashies/types';

const defaults = getWidgetDefaultConfig('damage') as unknown as DamageConfig;
const properties = getWidgetManifest('damage')?.properties ?? {};

export const useDamageSettings = (): DamageConfig => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === 'damage'
  )?.config;
  const merged = deepMergeConfig(
    defaults as unknown as Record<string, unknown>,
    saved
  ) as unknown as DamageConfig;
  return isConfigValid(properties, merged) ? merged : defaults;
};
