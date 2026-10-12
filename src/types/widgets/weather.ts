import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'weather',
  name: 'Weather',
  enabled: true,
  layout: {
    x: 1334,
    y: 271,
    width: 174,
    height: 425,
  },
  config: {
    background: {
      opacity: 25,
    },
    layout: 'vertical',
    horizontalMode: 'compact',
    units: 'auto',
    displayOrder: [
      'trackTemp',
      'airTemp',
      'wind',
      'humidity',
      'precipitation',
      'wetness',
      'trackState',
    ],
    airTemp: {
      enabled: true,
    },
    trackTemp: {
      enabled: true,
    },
    wetness: {
      enabled: true,
    },
    trackState: {
      enabled: true,
    },
    humidity: {
      enabled: true,
    },
    precipitation: {
      enabled: false,
    },
    wind: {
      enabled: true,
    },
    showOnlyWhenOnTrack: false,
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
    layout: {
      type: 'enum',
      label: 'Layout',
      options: [
        { value: 'vertical', label: 'Vertical' },
        { value: 'horizontal', label: 'Horizontal' },
      ],
    },
    horizontalMode: {
      type: 'enum',
      label: 'Horizontal View',
      options: [
        { value: 'compact', label: 'Compact' },
        { value: 'full', label: 'Full' },
      ],
    },
    units: {
      type: 'enum',
      label: 'Temperature Units',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'Metric', label: '\u00b0C' },
        { value: 'Imperial', label: '\u00b0F' },
      ],
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, weather will only be shown when driving',
    },
  },
});
