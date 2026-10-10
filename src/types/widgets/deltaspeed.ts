import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'deltaspeed',
  name: 'Delta Speed',
  enabled: false,
  layout: {
    x: 6,
    y: 870,
    width: 160,
    height: 40,
  },
  config: {
    background: { opacity: 80 },
    unit: 'km/h',
    scaleKph: 15,
    scaleMph: 10,
    capKph: 30,
    capMph: 20,
    // 0.2 mph is ~0.32 km/h, so the two thresholds feel the same in use
    // rather than mph being twice as twitchy.
    updateThresholdKph: 0.3,
    updateThresholdMph: 0.2,
    showNumber: true,
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
    scaleKph: {
      type: 'number',
      label: 'Full Colour At (km/h)',
      description:
        'Delta at which the background reaches full colour. Lower values make small differences more visible.',
      min: 5,
      max: 50,
      step: 1,
      units: ' km/h',
    },
    scaleMph: {
      type: 'number',
      label: 'Full Colour At (mph)',
      description:
        'The same limit used when displaying mph, kept separate so both stay whole numbers.',
      min: 3,
      max: 30,
      step: 1,
      units: ' mph',
    },
    capKph: {
      type: 'number',
      label: 'Maximum Shown (km/h)',
      description:
        'Largest delta shown as a number. Beyond this the readout holds at the limit instead of climbing.',
      min: 5,
      max: 60,
      step: 1,
      units: ' km/h',
    },
    capMph: {
      type: 'number',
      label: 'Maximum Shown (mph)',
      description:
        'The same limit used when displaying mph, kept separate so both stay whole numbers.',
      min: 3,
      max: 40,
      step: 1,
      units: ' mph',
    },
    updateThresholdKph: {
      type: 'number',
      label: 'Update Threshold (km/h)',
      description:
        'The number holds still until the delta has moved at least this far. Higher values stop the last digit flickering.',
      min: 0,
      max: 2,
      step: 0.1,
      units: ' km/h',
    },
    updateThresholdMph: {
      type: 'number',
      label: 'Update Threshold (mph)',
      description: 'The same threshold used when displaying mph.',
      min: 0,
      max: 2,
      step: 0.1,
      units: ' mph',
    },
    showNumber: {
      type: 'boolean',
      label: 'Show number',
      description: 'Show the numeric delta inside the box.',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, widget will only be shown when driving.',
    },
  },
});
