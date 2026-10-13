import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcastweather',
  name: 'Broadcast Weather',
  // Reached through a tab on the Broadcast settings page.
  hideInMenu: true,
  enabled: false,
  layout: {
    x: 320,
    y: 20,
    width: 280,
    height: 140,
  },
  config: {
    background: { opacity: 85 },
    intervalMinutes: 10,
    showSeconds: 12,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  },
});
