import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'wind',
  name: 'Wind',
  enabled: false,
  layout: {
    x: 1334,
    y: 471,
    width: 174,
    height: 200,
  },
  config: {
    background: {
      opacity: 80,
    },
    units: 'auto',
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
