import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'flatmap',
  name: 'Flat Track Map',
  enabled: false,
  layout: {
    x: 622,
    y: 700,
    width: 800,
    height: 150,
  },
  config: {
    showCarNumbers: true,
    displayMode: 'carNumber',
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackmapFontSize: 100,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
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
  },
});
