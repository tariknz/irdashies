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
});
