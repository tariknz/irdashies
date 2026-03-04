import { useDashboard } from '@irdashies/context';
import { FasterCarsFromBehindWidgetSettings } from '../../Settings/types';

const DEFAULT_CONFIG: FasterCarsFromBehindWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distanceThreshold: -1.5,
  numberDriversBehind: 1,
  alignDriverBoxes: 'Top',
  closestDriverBox: 'Top',
  showName: true,
  removeNumbersFromName: false,
  showDistance: true,
  showBadge: true,
  badgeFormat: 'license-color-rating-bw',
  onlyShowFasterClasses: true,
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
    showName: settings?.showName ?? DEFAULT_CONFIG.showName,
    removeNumbersFromName:
      settings?.removeNumbersFromName ?? DEFAULT_CONFIG.removeNumbersFromName,
    showDistance: settings?.showDistance ?? DEFAULT_CONFIG.showDistance,
    showBadge: settings?.showBadge ?? DEFAULT_CONFIG.showBadge,
    badgeFormat: settings?.badgeFormat ?? DEFAULT_CONFIG.badgeFormat,
    onlyShowFasterClasses:
      settings?.onlyShowFasterClasses ?? DEFAULT_CONFIG.onlyShowFasterClasses,
    sessionVisibility:
      settings?.sessionVisibility ?? DEFAULT_CONFIG.sessionVisibility,
  } as FasterCarsFromBehindWidgetSettings['config'];
};
