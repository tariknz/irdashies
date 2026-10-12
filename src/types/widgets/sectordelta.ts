import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'sectordelta',
  name: 'Sector Delta',
  enabled: false,
  layout: {
    x: 6,
    y: 800,
    width: 300,
    height: 60,
  },
  config: {
    background: { opacity: 80 },
    timeFormat: 'seconds-full',
    ghostComparison: 'prefer-ghost',
    trackIncidentSectors: true,
    alwaysScroll: false,
    maxSectorsShown: null,
    thresholds: null,
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
