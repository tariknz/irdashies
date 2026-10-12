import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'cornername',
  name: 'Corner Names',
  enabled: false,
  layout: {
    x: 50,
    y: 50,
    width: 350,
    height: 80,
  },
  config: {
    showCornerNumber: true,
    showProgressBar: true,
    showTrackPct: true,
    fontSize: 18,
    opacity: 0.9,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    showCornerNumber: {
      type: 'boolean',
      label: 'Show Corner Number',
      description: 'Display the corner number badge (e.g. T1, T3)',
    },
    showProgressBar: {
      type: 'boolean',
      label: 'Show Progress Bar',
      description: 'Display progress through the current section',
    },
    showTrackPct: {
      type: 'boolean',
      label: 'Show Track Percentage',
      description: 'Display overall track position percentage',
    },
    fontSize: {
      type: 'number',
      label: 'Font Size',
      description: 'Base font size for corner names (px)',
      control: 'input',
      min: 12,
      max: 32,
      step: 1,
    },
  },
});
