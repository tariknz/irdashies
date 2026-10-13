import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcastevents',
  name: 'Broadcast Events',
  // Reached through a tab on the Broadcast settings page.
  hideInMenu: true,
  enabled: false,
  layout: {
    x: 720,
    y: 40,
    width: 480,
    height: 120,
  },
  config: {
    background: { opacity: 90 },
    showSeconds: 8,
    kinds: {
      crash: true,
      offTrack: false,
      slowdown: true,
      blackFlag: true,
      yellow: true,
      caution: true,
      fastestLap: true,
      pitStop: true,
      meatball: true,
      disqualified: true,
      finalLap: true,
      checkered: true,
    },
    sessionVisibility: {
      race: true,
      loneQualify: false,
      openQualify: true,
      practice: false,
      offlineTesting: false,
    },
  },
});
