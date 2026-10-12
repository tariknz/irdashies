import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'weather',
  name: 'Weather',
  enabled: true,
  layout: {
    x: 1334,
    y: 271,
    width: 174,
    height: 425,
  },
  config: {
    background: {
      opacity: 25,
    },
    layout: 'vertical',
    horizontalMode: 'compact',
    units: 'auto',
    displayOrder: [
      'trackTemp',
      'airTemp',
      'wind',
      'humidity',
      'precipitation',
      'wetness',
      'trackState',
    ],
    airTemp: {
      enabled: true,
    },
    trackTemp: {
      enabled: true,
    },
    wetness: {
      enabled: true,
    },
    trackState: {
      enabled: true,
    },
    humidity: {
      enabled: true,
    },
    precipitation: {
      enabled: false,
    },
    wind: {
      enabled: true,
    },
    showOnlyWhenOnTrack: false,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
