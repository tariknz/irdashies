import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import { FlatTrackMapWidgetSettings } from '../../Settings/types';

export const useFlatTrackMapSettings = (): FlatTrackMapWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const widget = currentDashboard?.widgets.find((w) => w.id === 'flatmap');
    return widget?.config as FlatTrackMapWidgetSettings['config'];
  }, [currentDashboard]);
};
