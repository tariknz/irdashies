import { useDashboard } from '@irdashies/context';
import { FasterCarsFromBehindWidgetSettings } from '../../Settings/types';

const DEFAULT_CONFIG: FasterCarsFromBehindWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distanceThreshold: -0.3,
  numberDriversBehind: 1,
  alignDriverBoxes: 'Top',
  closestDriverBox: 'Top',
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

export const useFasterCarsSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'fastercarsfrombehind'
  )?.config;

  return {
    showOnlyWhenOnTrack:
      (settings?.showOnlyWhenOnTrack as boolean) ??
      DEFAULT_CONFIG.showOnlyWhenOnTrack,
    distanceThreshold:
      settings?.distanceThreshold ?? DEFAULT_CONFIG.distanceThreshold,
    numberDriversBehind:
      settings?.numberDriversBehind ?? DEFAULT_CONFIG.numberDriversBehind,
    alignDriverBoxes:
      settings?.alignDriverBoxes ?? DEFAULT_CONFIG.alignDriverBoxes,
    closestDriverBox:
      settings?.closestDriverBox ?? DEFAULT_CONFIG.closestDriverBox,
    sessionVisibility:
      settings?.sessionVisibility ?? DEFAULT_CONFIG.sessionVisibility,
  } as FasterCarsFromBehindWidgetSettings['config'];
};
