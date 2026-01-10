import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';

interface FlatTrackMapSettings {
  enabled: boolean;
  config: {
    showCarNumbers: boolean;
    useHighlightColor: boolean;
    driverCircleSize: number;
    playerCircleSize: number;
    trackLineWidth: number;
    trackOutlineWidth: number;
    invertTrackColors: boolean;
  };
}

export const useFlatTrackMapSettings = (): FlatTrackMapSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const widget = currentDashboard?.widgets.find((w) => w.id === 'flatmap');
    return widget?.config as FlatTrackMapSettings['config'];
  }, [currentDashboard]);
};
