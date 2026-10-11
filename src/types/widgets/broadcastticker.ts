import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcastticker',
  name: 'Broadcast Ticker',
  // Reached through a tab on the Broadcast settings page.
  hideInMenu: true,
  enabled: false,
  layout: {
    x: 0,
    y: 1000,
    width: 1920,
    height: 72,
  },
  config: {
    background: { opacity: 85 },
    translucent: { enabled: false, opacity: 70 },
    secondsPerEntry: 3,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
