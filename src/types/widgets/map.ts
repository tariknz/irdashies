import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'map',
  name: 'Track Map',
  enabled: true,
  layout: {
    x: 1102,
    y: 41,
    width: 407,
    height: 227,
  },
  config: {
    turnLabels: {
      enabled: false,
      labelType: 'both',
      highContrast: true,
      labelFontSize: 100,
    },
    showCarNumbers: true,
    invertTrackColors: false,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackmapFontSize: 100,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    useHighlightColor: false,
    invertLeaderColor: false,
    showOnlyWhenOnTrack: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    styling: { isMinimalTrack: false, isMinimalCar: false },
    sectorColoring: { enabled: false },
    playerIcon: { enabled: false, fileName: '' },
  },
});
