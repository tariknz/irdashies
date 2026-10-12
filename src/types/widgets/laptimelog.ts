import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'laptimelog',
  name: 'Lap Timer',
  enabled: false,
  layout: {
    x: 300,
    y: 100,
    width: 250,
    height: 250,
  },
  config: {
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: true,
    showPredictedLap: true,
    showLastLap: true,
    showBestLap: true,
    showAllTimeLap: false,
    delta: {
      enabled: true,
      method: 'bestlap',
    },
    history: {
      enabled: true,
      count: 10,
      style: 'list',
      hidePittedLaps: false,
    },
    background: {
      opacity: 80,
    },
    foreground: {
      opacity: 70,
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
    showOnlyWhenOnTrack: true,
  },
});
