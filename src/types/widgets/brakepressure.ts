import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'brakepressure',
  name: 'Brake Pressure',
  enabled: false,
  layout: { x: 1040, y: 490, width: 220, height: 150 },
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
  },
});
