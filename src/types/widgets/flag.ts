import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'flag',
  name: 'Flag',
  enabled: false,
  layout: {
    x: 100,
    y: 50,
    width: 190,
    height: 240,
  },
  config: {
    enabled: true,
    showOnlyWhenOnTrack: false,
    showLabel: false,
    animate: true,
    blinkPeriod: 0.5,
    matrixMode: '16x16',
    showNoFlagState: true,
    enableGlow: true,
    doubleFlag: false,
    background: { opacity: 80 },
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
    doubleFlag: {
      type: 'boolean',
      label: 'Double Flag',
      description: 'When enabled two flags will be displayed',
    },
    matrixMode: {
      type: 'enum',
      label: 'Matrix Mode',
      description: 'Choose between 8x8, 16x16, or uniform color rendering.',
      options: [
        { value: '8x8', label: '8x8' },
        { value: '16x16', label: '16x16' },
        { value: 'uniform', label: 'Uniform (1x1)' },
      ],
      control: 'select',
    },
    animate: {
      type: 'boolean',
      label: 'Animate Flag',
      description: 'When enabled the flag will blink on/off',
    },
    blinkPeriod: {
      type: 'number',
      label: 'Blink Period (s)',
      description:
        'Set how many seconds between on/off when animation is enabled. Min 0.1s, Max 3s.',
      control: 'input',
      min: 0.1,
      max: 3,
      step: 0.1,
    },
    showLabel: {
      type: 'boolean',
      label: 'Show Flag Label',
      description: 'Toggle display of the flag name text',
    },
    showNoFlagState: {
      type: 'boolean',
      label: 'Show No Flag State',
      description: "Display 'no flag' (grey leds) when no flags are waved",
    },
    enableGlow: {
      type: 'boolean',
      label: 'Enable Glow Effect',
      description: 'Add a glow effect around the matrix lights',
    },
    showOnlyWhenOnTrack: {
      type: 'boolean',
      label: 'Show only when on track',
      description: 'If enabled, flags will only be shown when driving',
    },
  },
});
