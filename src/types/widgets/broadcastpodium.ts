import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'broadcastpodium',
  name: 'Broadcast Podium',
  category: 'Broadcast',
  // Reached through the Broadcast menu.
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
