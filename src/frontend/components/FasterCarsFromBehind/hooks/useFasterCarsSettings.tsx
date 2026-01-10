import { useDashboard } from '@irdashies/context';
import { FasterCarsFromBehindWidgetSettings } from '../../Settings/types';

const DEFAULT_CONFIG: FasterCarsFromBehindWidgetSettings['config'] = {
  distanceThreshold: -0.3,
  sessionVisibility: { race: true, loneQualify: false, openQualify: true, practice: true, offlineTesting: true },
};

export const useFasterCarsSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'fastercarsfrombehind',
  )?.config;

  return {
    distanceThreshold: settings?.distanceThreshold ?? DEFAULT_CONFIG.distanceThreshold,
    sessionVisibility: settings?.sessionVisibility ?? DEFAULT_CONFIG.sessionVisibility,
  } as FasterCarsFromBehindWidgetSettings['config'];
}; 