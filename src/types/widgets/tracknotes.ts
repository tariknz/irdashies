import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'tracknotes',
  name: 'Track Notes',
  enabled: false,
  layout: { x: 600, y: 120, width: 420, height: 100 },
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
    triggerDistancePct: 0.003,
    notes: [],
  },
});
