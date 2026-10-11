import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'cornername',
  name: 'Corner Names',
  enabled: false,
  layout: {
    x: 50,
    y: 50,
    width: 350,
    height: 80,
  },
  config: {
    showCornerNumber: true,
    showProgressBar: true,
    showTrackPct: true,
    fontSize: 18,
    opacity: 0.9,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
