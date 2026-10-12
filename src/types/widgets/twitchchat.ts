import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'twitchchat',
  name: 'Twitch Chat',
  alwaysEnabled: true,
  enabled: false,
  layout: {
    x: 378,
    y: 102,
    width: 400,
    height: 500,
  },
  config: {
    fontSize: 16,
    channel: '',
    background: {
      opacity: 30,
    },
    autoHide: {
      enabled: false,
      intervalSeconds: 20,
    },
  },
});
