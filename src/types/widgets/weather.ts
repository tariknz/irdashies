import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'weather',
  name: 'Weather',
  category: 'Session & Weather',
  enabled: true,
  layout: {
    x: 1334,
    y: 271,
    width: 380,
    height: 142,
  },
  config: {
    background: {
      opacity: 90,
    },
    units: 'auto',
    forecast: {
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
    'forecast.enabled': {
      type: 'boolean',
      label: 'Show forecast',
      description:
        'Colour-coded estimate of the next three hours, from the session trend',
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
