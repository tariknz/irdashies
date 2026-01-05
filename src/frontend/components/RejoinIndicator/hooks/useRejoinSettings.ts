import { useDashboard } from '@irdashies/context';
import type { RejoinIndicatorWidgetSettings } from '../../Settings/types';

const DEFAULT_CONFIG: RejoinIndicatorWidgetSettings = {
  enabled: false,
  config: {
    showAtSpeed: 30,
    careGap: 2,
    stopGap: 1,
  },
};

export const useRejoinSettings = () => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'rejoin') as
    | RejoinIndicatorWidgetSettings
    | undefined;

  if (saved && typeof saved === 'object') {
    // Merge saved config with defaults to support older dashboards missing keys
    return {
      enabled: saved.enabled ?? DEFAULT_CONFIG.enabled,
      config: {
        showAtSpeed: (saved.config as RejoinIndicatorWidgetSettings['config'])?.showAtSpeed ?? DEFAULT_CONFIG.config.showAtSpeed,
        careGap: (saved.config as RejoinIndicatorWidgetSettings['config'])?.careGap ?? DEFAULT_CONFIG.config.careGap,
        stopGap: (saved.config as RejoinIndicatorWidgetSettings['config'])?.stopGap ?? DEFAULT_CONFIG.config.stopGap,
      },
    } as RejoinIndicatorWidgetSettings;
  }

  return DEFAULT_CONFIG;
};
