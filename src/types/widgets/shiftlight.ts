import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'shiftlight',
  name: 'Shift Light',
  enabled: false,
  layout: {
    x: 422,
    y: 664,
    width: 200,
    height: 50,
  },
  config: {
    showRpmText: true,
    shiftPointSettings: {
      enabled: false,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {},
    },
    background: { opacity: 80 },
    showOnlyWhenOnTrack: true,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
