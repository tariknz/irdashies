import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'deltaspeed',
  name: 'Delta Speed',
  enabled: false,
  layout: {
    x: 6,
    y: 870,
    width: 160,
    height: 40,
  },
  config: {
    background: { opacity: 80 },
    unit: 'km/h',
    scaleKph: 15,
    scaleMph: 10,
    capKph: 30,
    capMph: 20,
    // 0.2 mph is ~0.32 km/h, so the two thresholds feel the same in use
    // rather than mph being twice as twitchy.
    updateThresholdKph: 0.3,
    updateThresholdMph: 0.2,
    showNumber: true,
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
