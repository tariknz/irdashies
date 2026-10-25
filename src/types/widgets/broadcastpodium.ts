import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcastpodium',
  name: 'Broadcast Podium',
  // Reached through a tab on the Broadcast settings page.
  hideInMenu: true,
  enabled: false,
  layout: {
    x: 320,
    y: 180,
    width: 320,
    height: 400,
  },
  config: {
    background: { opacity: 90 },
    style: 'steps',
  },
});
