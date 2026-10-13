import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'carsystems',
  name: 'Car Systems',
  enabled: false,
  layout: {
    x: 6,
    y: 620,
    // Wide and short: the systems read left to right as columns, so the
    // default slot is shaped for a strip rather than the tall table this
    // widget used to be.
    width: 380,
    height: 70,
  },
  config: {
    rows: [
      'dcBrakeBias',
      'dcABS',
      'dcTractionControl',
      'dcTractionControl2',
      'dcThrottleShape',
    ],
    showUnsupportedRows: true,
    showOffRows: true,
    background: { opacity: 80 },
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
      description: 'Opacity of the widget background.',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    showUnsupportedRows: {
      type: 'boolean',
      label: 'Keep rows the car does not have',
      description:
        'Shows a blank row so each adjustment keeps the same position between cars. Turn off to show only what the current car exposes.',
    },
    showOffRows: {
      type: 'boolean',
      label: 'Keep rows switched off',
      description:
        'Shows a system the driver has turned off, greyed and reading zero. Turn off to leave only the systems actually in use.',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, widget will only be shown when driving.',
    },
  },
});
