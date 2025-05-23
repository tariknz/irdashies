import { useDashboard } from '@irdashies/context';

interface FasterCarsFromBehindSettings {
  enabled: boolean;
  config: {
    distanceThreshold: number;
  };
}

export const useFasterCarsSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'fastercarsfrombehind',
  )?.config;

  // Add type guard to ensure settings matches expected shape
  if (settings && 
    typeof settings === 'object' &&
    'distanceThreshold' in settings &&
    typeof settings.distanceThreshold === 'number'
  ) {
    return settings as FasterCarsFromBehindSettings['config'];
  }

  return undefined;
}; 