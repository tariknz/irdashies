import { useDashboard } from '@irdashies/context';
import { GarageCoverWidgetSettings } from '@irdashies/types';
import { useMemo } from 'react';

const defaultConfig: GarageCoverWidgetSettings['config'] = {
  imageFilename: '',
};

export const useGarageCoverSettings = () => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const garageCoverSettings = currentDashboard?.widgets.find(
      (widget) => widget.id === 'garagecover'
    )?.config;

    return {
      ...defaultConfig,
      ...(garageCoverSettings as unknown as GarageCoverWidgetSettings['config']),
    };
  }, [currentDashboard]);
};
