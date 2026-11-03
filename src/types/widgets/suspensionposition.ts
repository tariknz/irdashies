import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'suspensionposition',
  name: 'Suspension Position',
  enabled: false,
  layout: { x: 1280, y: 490, width: 220, height: 150 },
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
