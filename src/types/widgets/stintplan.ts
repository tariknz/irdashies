import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'stintplan',
  name: 'Stint Plan',
  enabled: false,
  layout: {
    x: 20,
    y: 420,
    width: 300,
    height: 170,
  },
  config: {
    background: { opacity: 80 },
    showElapsedTime: true,
    showFuel: true,
    showNextDriver: true,
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
    showElapsedTime: {
      type: 'boolean',
      label: 'Show race elapsed time',
      description:
        'Show the race time next to the local time, for example 01:42 (+12:42).',
    },
    showFuel: {
      type: 'boolean',
      label: 'Show fuel target',
      description:
        "Compare the plan's fuel per lap with the measured figure. Hidden when the team car's fuel cannot be seen.",
    },
    showNextDriver: {
      type: 'boolean',
      label: 'Show next driver',
      description: 'Show who drives next and when their stint starts.',
    },
  },
});
