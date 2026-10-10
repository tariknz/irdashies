import { sessionVisibilityProperties } from './properties';
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
  properties: {
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 1,
      units: '%',
    },
    units: {
      type: 'enum',
      label: 'Speed Units',
      options: [
        { value: 'auto', label: 'Auto' },
        { value: 'Metric', label: 'km/h' },
        { value: 'Imperial', label: 'mph' },
      ],
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, wind will only be shown when driving',
    },
    ...sessionVisibilityProperties(),
  },
});
