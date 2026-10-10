import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'flatmap',
  name: 'Flat Track Map',
  enabled: false,
  layout: {
    x: 622,
    y: 700,
    width: 800,
    height: 150,
  },
  config: {
    showCarNumbers: true,
    displayMode: 'carNumber',
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackmapFontSize: 100,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    useHighlightColor: false,
    invertLeaderColor: false,
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
    trackLineWidth: {
      type: 'number',
      label: 'Track Line Width',
      description:
        'Thickness of the track line (matches curved track map scale)',
      min: 5,
      max: 40,
      step: 1,
      units: 'px',
    },
    trackOutlineWidth: {
      type: 'number',
      label: 'Track Outline Width',
      description: 'Thickness of the outline around the track',
      min: 10,
      max: 80,
      step: 1,
      units: 'px',
    },
    invertTrackColors: {
      type: 'boolean',
      label: 'Invert Track Colors',
      description: 'Swap black and white colors for the track',
    },
    showCarNumbers: {
      type: 'boolean',
      label: 'Show Car Numbers',
      description: 'Display car numbers on driver circles',
    },
    displayMode: {
      type: 'enum',
      label: 'Display Mode',
      options: [
        { value: 'carNumber', label: 'Car Number' },
        { value: 'sessionPosition', label: 'Session Position' },
        { value: 'livePosition', label: 'Live Position' },
      ],
    },
    driverCircleSize: {
      type: 'number',
      label: 'Driver Circle Size',
      description:
        'Size of the circle for other drivers (matches curved track map scale)',
      min: 10,
      max: 80,
      step: 1,
      units: 'px',
    },
    playerCircleSize: {
      type: 'number',
      label: 'Player Circle Size',
      description:
        'Size of the circle for your car (matches curved track map scale)',
      min: 10,
      max: 80,
      step: 1,
      units: 'px',
    },
    trackmapFontSize: {
      type: 'number',
      label: 'Relative Font Size',
      description: 'Relative size of the font within the trackmap',
      min: 50,
      max: 150,
      step: 1,
      units: '%',
    },
    useHighlightColor: {
      type: 'boolean',
      label: 'Use Highlight Color for Player',
      description:
        'Use your custom highlight color for the player car instead of class color',
    },
    invertLeaderColor: {
      type: 'boolean',
      label: 'Use Inverted Color for the Leader',
      description:
        'Use an alternate color for the leader car instead of class color',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, track map will only be shown when driving',
    },
  },
});
