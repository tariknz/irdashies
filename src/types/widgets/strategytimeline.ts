import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'strategytimeline',
  name: 'Strategy Timeline',
  enabled: false,
  layout: {
    x: 20,
    y: 100,
    width: 440,
    height: 480,
  },
  config: {
    background: { opacity: 80 },
    showElapsedTime: true,
    showStrip: true,
    showDoneStints: true,
    showStops: true,
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
    showStrip: {
      type: 'boolean',
      label: 'Show race strip',
      description:
        'A bar across the whole race with each stint and a marker for now.',
    },
    showDoneStints: {
      type: 'boolean',
      label: 'Show finished stints',
      description: 'Keep stints that are already done in the list.',
    },
    showStops: {
      type: 'boolean',
      label: 'Show unplanned stops',
      description: 'List the most recent stops that were not on the plan.',
    },
  },
});
