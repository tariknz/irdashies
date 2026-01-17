import { useDashboard } from '@irdashies/context';
import type { PitlaneHelperWidgetSettings } from '../../Settings/types';

export const usePitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();

  const widget = currentDashboard?.widgets?.find(
    (w) => w.id === 'pitlanehelper'
  ) as PitlaneHelperWidgetSettings | undefined;

  const config = widget?.config ?? {
    showMode: 'approaching' as const,
    approachDistance: 200,
    enablePitLimiterWarning: true,
    enableEarlyPitboxWarning: true,
    earlyPitboxThreshold: 75,
    showPitlaneTraffic: true,
    background: { opacity: 80 },
  };

  return config;
};
