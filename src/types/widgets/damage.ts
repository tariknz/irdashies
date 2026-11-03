import { sessionVisibilityProperties } from './properties';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'damage',
  name: 'Damage',
  menuLabel: 'Damage',
  enabled: false,
  layout: {
    x: 40,
    y: 480,
    width: 160,
    height: 220,
  },
  config: {
    background: {
      opacity: 80,
    },
    showOnlyWhenOnTrack: true,
    showOnlyWhenDamaged: false,
    showIntegrity: true,
    showStats: true,
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
      step: 5,
      units: '%',
    },
    showIntegrity: {
      type: 'boolean',
      label: 'Show Integrity %',
      description:
        'Centre reading: aero integrity when available, otherwise bodywork.',
    },
    showStats: {
      type: 'boolean',
      label: 'Show Integrity Bars',
      description: 'Aero, body, suspension and tyre remaining integrity rows.',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, damage is only shown when driving.',
    },
    showOnlyWhenDamaged: {
      type: 'boolean',
      label: 'Show only when damaged',
      description:
        'Hide the widget until body, aero, suspension, puncture, or repair damage is detected.',
    },
    ...sessionVisibilityProperties(),
  },
});
