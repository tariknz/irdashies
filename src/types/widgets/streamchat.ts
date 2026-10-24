import { defineWidgetManifest } from './types';

export default defineWidgetManifest({
  id: 'streamchat',
  name: 'Stream Chat',
  alwaysEnabled: true,
  enabled: false,
  layout: {
    x: 378,
    y: 102,
    width: 400,
    height: 500,
  },
  config: {
    display: {
      fontSize: 16,
      background: {
        opacity: 30,
      },
      autoHide: {
        enabled: false,
        intervalSeconds: 20,
      },
      showPlatformIcons: true,
    },
    twitch: {
      channel: '',
    },
    youtube: {
      channel: '',
    },
  },
  properties: {
    'display.background.opacity': {
      type: 'number',
      label: 'Background Opacity',
      min: 0,
      max: 100,
      step: 5,
      units: '%',
    },
    'display.fontSize': {
      type: 'number',
      label: 'Font size',
      min: 8,
      max: 45,
      step: 1,
      units: 'px',
    },
    'display.autoHide.enabled': {
      type: 'boolean',
      label: 'Automatic message disappearance',
      description: 'Messages will automatically disappear after the set time.',
    },
    'display.autoHide.intervalSeconds': {
      type: 'number',
      label: 'Disappearance interval',
      min: 10,
      max: 90,
      step: 1,
      units: 's',
    },
    'display.showPlatformIcons': {
      type: 'boolean',
      label: 'Show platform icons',
      description:
        'Show the Twitch or YouTube logo in front of each message to mark where it came from.',
    },
  },
});
