import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'blindspotmonitor',
  name: 'Blind Spot Monitor',
  enabled: false,
  layout: {
    x: 378,
    y: 102,
    width: 800,
    height: 500,
  },
  config: {
    showOnlyWhenOnTrack: false,
    distAhead: 4.5,
    distBehind: 4.5,
    background: {
      opacity: 30,
    },
    width: 20,
    borderSize: 1,
    indicatorColor: 16096779,
    displayMode: 'standard',
    simpleSize: 44,
    simpleVerticalPosition: 50,
    simpleShowCount: true,
    thresholdColorsEnabled: false,
    thresholdColor1: 16096779,
    thresholdColor2: 15680580,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
