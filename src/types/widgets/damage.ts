import { sessionVisibilityProperties } from './properties';
import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'damage',
  name: 'Damage',
  menuLabel: 'Damage',
  category: 'Car & Controls',
  enabled: false,
  layout: {
    x: 40,
    y: 480,
    width: 170,
    height: 240,
  },
  config: {
    background: {
      opacity: 80,
    },
    showOnlyWhenOnTrack: true,
    showOnlyWhenDamaged: false,
    showIntegrity: true,
    showStats: false,
    showTyreWear: true,
    showCornerBadges: true,
    showCornerPct: false,
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
      label: 'Show Damage %',
      description:
        'Show remaining integrity next to each damaged body or suspension area (hidden at 100%).',
    },
    showStats: {
      type: 'boolean',
      label: 'Show Integrity Bars',
      description:
        'Show aero, body, suspension and tyre integrity bars and repair times under the silhouette.',
    },
    showTyreWear: {
      type: 'boolean',
      label: 'Show Tyre Wear',
      description:
        'Colour each wheel by its remaining tread. A puncture or a lost wheel still shows when off.',
    },
    showCornerBadges: {
      type: 'boolean',
      label: 'Show Corner Badges',
      description:
        'Show the LF, RF, LR and RR badges under the car, coloured by each wheel and its suspension.',
    },
    showCornerPct: {
      type: 'boolean',
      label: 'Show Tyre % In Corner Badges',
      description:
        'Show the remaining tread next to LF, RF, LR and RR, when the sim reports it.',
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
