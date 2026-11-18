import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'frictioncircle',
  name: 'Friction Circle',
  category: 'Car & Controls',
  enabled: false,
  layout: { x: 1040, y: 120, width: 180, height: 210 },
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
