import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'battle',
  name: 'Battle',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 460,
    height: 100,
  },
  config: {
    background: { opacity: 80 },
    showOnlyWhenOnTrack: false,
    position: { enabled: true },
    carNumber: { enabled: true },
    driverName: { enabled: true },
    stint: { enabled: true },
    lastTime: { enabled: true, timeFormat: 'mixed' },
    speed: { enabled: false, unit: 'auto' },
    gap: { enabled: true, decimalPlaces: 2 },
    displayOrder: [
      'position',
      'carNumber',
      'driverName',
      'stint',
      'lastTime',
      'speed',
      'gap',
    ],
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: false,
      practice: false,
      offlineTesting: false,
    },
  },
});
