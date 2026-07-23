import { useDashboard } from '@irdashies/context';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type ShiftLightsConfig,
} from '@irdashies/types';

const defaults = getWidgetDefaultConfig('shiftlights');

export const useShiftLightsSettings = (): ShiftLightsConfig => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(
    (candidate) => (candidate.type ?? candidate.id) === 'shiftlights'
  );
  return deepMergeConfig(
    defaults as unknown as Record<string, unknown>,
    widget?.config
  ) as unknown as ShiftLightsConfig;
};
