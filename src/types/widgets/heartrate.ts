import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'heartrate',
  name: 'Heart Rate',
  alwaysEnabled: true,
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 230,
    height: 112,
  },
  config: {
    deviceId: '',
    widgetUrl: '',
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
