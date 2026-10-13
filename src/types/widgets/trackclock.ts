import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'trackclock',
  name: 'Track Clock',
  enabled: false,
  layout: { x: 1040, y: 660, width: 220, height: 80 },
  config: {
    background: { opacity: 80 },
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
