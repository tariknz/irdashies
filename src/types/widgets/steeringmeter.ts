import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'steeringmeter',
  name: 'Steering Meter',
  enabled: false,
  layout: { x: 600, y: 540, width: 300, height: 100 },
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
