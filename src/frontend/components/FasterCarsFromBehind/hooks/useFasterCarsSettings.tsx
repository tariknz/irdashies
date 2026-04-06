import { useDashboard } from '@irdashies/context';
import { FasterCarsFromBehindWidgetSettings } from '@irdashies/types';

const DEFAULT_CONFIG: FasterCarsFromBehindWidgetSettings['config'] = {
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
};

export const useFasterCarsSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'fastercarsfrombehind'
  )?.config;

  return {
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
  } as FasterCarsFromBehindWidgetSettings['config'];
};
