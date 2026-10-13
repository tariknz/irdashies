import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'tyrepanel',
  name: 'Tyre Panel',
  enabled: false,
  layout: { x: 1040, y: 350, width: 300, height: 180 },
  config: {
    background: { opacity: 80 },
    showOnlyWhenOnTrack: true,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    pressureUnit: 'kPa',
    temperatureUnit: 'C',
    temperatureThresholds: { cold: 70, hot: 100 },
    wearThresholds: { worn: 60, replace: 30 },
  },
});
