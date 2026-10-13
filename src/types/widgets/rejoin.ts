import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'rejoin',
  name: 'Rejoin Indicator',
  enabled: false,
  layout: {
    x: 378,
    y: 102,
    width: 800,
    height: 500,
  },
  config: {
    showAtSpeed: 30,
    clearGap: 3.5,
    careGap: 2,
    stopGap: 1,
    width: 20,
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
  properties: {
    showAtSpeed: {
      type: 'number',
      control: 'input',
      label: 'Show At Speed',
      description:
        'Display the rejoin indicator widget when you are at or below this speed',
      min: 0,
      step: 0.1,
    },
    careGap: {
      type: 'number',
      control: 'input',
      label: 'Care Gap',
      description:
        'Distance to the car behind where you need to be cautious when rejoining. Note: the clear status will show when next car is above this gap',
      min: 0,
      step: 0.1,
    },
    stopGap: {
      type: 'number',
      control: 'input',
      label: 'Stop Gap',
      description: 'Distance to the car behind where it is not safe to rejoin',
      min: 0,
      step: 0.1,
    },
  },
});
