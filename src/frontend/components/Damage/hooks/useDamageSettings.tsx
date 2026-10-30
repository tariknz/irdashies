import { useDashboard } from '@irdashies/context';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type DamageConfig,
} from '@irdashies/types';

const defaults = getWidgetDefaultConfig('damage');

export const useDamageSettings = (): DamageConfig => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => (widget.type || widget.id) === 'damage'
  )?.config;
  return deepMergeConfig(
    defaults as unknown as Record<string, unknown>,
    saved
  ) as unknown as DamageConfig;
};
