import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'slowcarahead',
  name: 'Slow Car Ahead',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 450,
    height: 50,
  },
  config: {
    maxDistance: 250,
    slowSpeedThreshold: 50,
    stoppedSpeedThreshold: 5,
    barThickness: 10,
    showOnlyWhenOnTrack: true,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    maxDistance: {
      type: 'number',
      label: 'Maximum Distance (m)',
      description:
        'The maximum distance the slow car can be for the widget to be visible.',
      control: 'input',
      min: 100,
      max: 999,
      step: 1,
    },
    slowSpeedThreshold: {
      type: 'number',
      label: 'Slow Speed Threshold (km/h)',
      description:
        'The threshold for when a car is considered slow, and the widget will appear.',
      control: 'input',
      min: 1,
      max: 100,
      step: 1,
    },
    stoppedSpeedThreshold: {
      type: 'number',
      label: 'Stopped Speed Threshold (km/h)',
      description:
        'The threshold for when a car is considered stopped, and the bar will turn red.',
      control: 'input',
      min: 1,
      max: 100,
      step: 1,
    },
    barThickness: {
      type: 'number',
      label: 'Bar Thickness',
      description: 'The thickness of the colored bar of the widget (px).',
      min: 0,
      max: 100,
      step: 1,
      units: 'px',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, widget will only be shown when driving',
    },
  },
});
