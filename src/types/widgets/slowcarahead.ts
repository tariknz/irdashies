import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'slowcarahead',
  name: 'Slow Car Ahead',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 450,
    height: 50,
  },
  config: {
    maxDistance: 250,
    slowSpeedThreshold: 50,
    stoppedSpeedThreshold: 5,
    barThickness: 10,
    showOnlyWhenOnTrack: true,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
