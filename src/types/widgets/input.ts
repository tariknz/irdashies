import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'input',
  name: 'Input Traces',
  menuLabel: 'Input',
  enabled: true,
  layout: {
    x: 622,
    y: 864,
    width: 396,
    height: 92,
  },
  config: {
    useRawValues: false,
    trace: {
      enabled: true,
      includeThrottle: true,
      includeBrake: true,
      includeAbs: true,
      includeSteer: true,
      includeClutch: false,
      strokeWidth: 3,
      maxSamples: 400,
    },
    bar: {
      enabled: true,
      includeClutch: true,
      includeBrake: true,
      includeThrottle: true,
      includeAbs: true,
    },
    gear: {
      enabled: true,
      size: 100,
      showspeed: true,
      showspeedunit: true,
      swapSpeedUnit: false,
      unit: 'auto',
    },
    abs: {
      enabled: false,
    },
    steer: {
      enabled: true,
      config: {
        style: 'default',
        color: 'light',
      },
    },
    background: {
      opacity: 80,
    },
    showOnlyWhenOnTrack: true,
    displayOrder: ['trace', 'bar', 'gear', 'steer'],
    shiftFlash: {
      enabled: false,
      source: 'redline',
      color: '#9333ea',
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
