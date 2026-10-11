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
});
