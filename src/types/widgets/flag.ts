import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'flag',
  name: 'Flag',
  enabled: false,
  layout: {
    x: 100,
    y: 50,
    width: 190,
    height: 240,
  },
  config: {
    enabled: true,
    showOnlyWhenOnTrack: false,
    showLabel: false,
    animate: true,
    blinkPeriod: 0.5,
    matrixMode: '16x16',
    showNoFlagState: true,
    enableGlow: true,
    doubleFlag: false,
    background: { opacity: 80 },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
