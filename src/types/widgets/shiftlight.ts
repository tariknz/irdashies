import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'shiftlight',
  name: 'Shift Light',
  enabled: false,
  layout: {
    x: 422,
    y: 664,
    width: 200,
    height: 50,
  },
  config: {
    showRpmText: true,
    shiftPointSettings: {
      enabled: false,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {},
    },
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
  properties: {
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 1,
      units: '%',
    },
    showRpmText: { type: 'boolean', label: 'Show RPM Text' },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, Shift Light will only be shown when driving',
    },
  },
});
