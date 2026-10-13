import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'accelerationtimer',
  name: 'Acceleration Timer',
  enabled: false,
  layout: { x: 600, y: 240, width: 260, height: 120 },
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
    ranges: [
      { fromKph: 0, toKph: 100 },
      { fromKph: 100, toKph: 200 },
    ],
  },
});
