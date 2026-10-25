import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'sectordelta',
  name: 'Sector Delta',
  enabled: false,
  layout: {
    x: 6,
    y: 800,
    width: 300,
    height: 60,
  },
  config: {
    background: { opacity: 80 },
    timeFormat: 'seconds-full',
    ghostComparison: 'prefer-ghost',
    trackIncidentSectors: true,
    alwaysScroll: false,
    maxSectorsShown: null,
    thresholds: null,
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
      description: 'Opacity of the widget background.',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    timeFormat: {
      type: 'enum',
      label: 'Time Format',
      description:
        'Decimal precision for sector times and deltas. Always shown as total seconds.',
      options: [
        { value: 'seconds-full', label: '42.123' },
        { value: 'seconds-2', label: '42.12' },
        { value: 'seconds-mixed', label: '42.1' },
      ],
      control: 'select',
    },
    ghostComparison: {
      type: 'enum',
      label: 'Comparison Source',
      description: 'Choose what to compare sector times against.',
      options: [
        { value: 'prefer-ghost', label: 'Ghost When Available' },
        { value: 'session-best-only', label: 'Session Best Only' },
      ],
      control: 'select',
    },
    trackIncidentSectors: {
      type: 'boolean',
      label: 'Track incident sectors',
      description:
        'When enabled, sectors with incidents are recorded and shown with a warning icon. When disabled, sectors with incidents are discarded.',
    },
    alwaysScroll: {
      type: 'boolean',
      label: 'Always scroll',
      description:
        'Keep the strip continuously scrolling with your position pinned to the center, even when all sectors fit in the widget.',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, widget will only be shown when driving.',
    },
  },
});
