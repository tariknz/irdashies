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
  properties: {
    'background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    fontSize: {
      type: 'number',
      label: 'Font size',
      min: 8,
      max: 45,
      step: 1,
      units: 'px',
    },
    'autoHide.enabled': {
      type: 'boolean',
      label: 'Automatic message disappearance',
      description: 'Messages will automatically disappear after the set time.',
    },
    'autoHide.intervalSeconds': {
      type: 'number',
      label: 'Disappearance interval',
      min: 10,
      max: 90,
      step: 1,
      units: 's',
    },
  },
});
