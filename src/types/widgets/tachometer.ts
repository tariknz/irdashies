import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'tachometer',
  name: 'Tachometer',
  enabled: false,
  layout: {
    x: 622,
    y: 864,
    width: 496,
    height: 50,
  },
  config: {
    showRpmText: false,
    rpmOrientation: 'horizontal',
    oilTemp: { enabled: true, position: 'top', edgeOffset: 0 },
    waterTemp: { enabled: true, position: 'top', edgeOffset: 0 },
    tempLayout: { swapSides: false },
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
    rpmOrientation: {
      type: 'enum',
      label: 'RPM Text Orientaion',
      options: [
        { value: 'horizontal', label: 'Horizontal' },
        { value: 'bottom', label: 'Bottom' },
        { value: 'top', label: 'Top' },
      ],
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, tachometer will only be shown when driving',
    },
  },
});
