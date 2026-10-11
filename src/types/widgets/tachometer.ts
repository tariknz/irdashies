import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'tachometer',
  name: 'Tachometer',
  enabled: false,
  layout: {
    x: 622,
    y: 864,
    width: 496,
    height: 50,
  },
  config: {
    showRpmText: false,
    rpmOrientation: 'horizontal',
    oilTemp: { enabled: true, position: 'top', edgeOffset: 0 },
    waterTemp: { enabled: true, position: 'top', edgeOffset: 0 },
    tempLayout: { swapSides: false },
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
