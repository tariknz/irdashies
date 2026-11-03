import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'stinthistory',
  name: 'Stint History',
  enabled: false,
  layout: { x: 600, y: 380, width: 400, height: 140 },
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
    maxStints: 3,
  },
});
