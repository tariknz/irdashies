import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'fastercarsfrombehind',
  name: 'Faster Cars From Behind',
  menuLabel: 'Faster Cars Behind',
  enabled: false,
  layout: {
    x: 588,
    y: 44,
    width: 405,
    height: 43,
  },
  config: {
    distanceThreshold: -1.5,
    onlyShowFasterClasses: true,
    showOnlyWhenOnTrack: false,
    numberDriversBehind: 3,
    alignDriverBoxes: 'Top',
    closestDriverBox: 'Top',
    showName: true,
    removeNumbersFromName: false,
    showDistance: true,
    showBadge: false,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
