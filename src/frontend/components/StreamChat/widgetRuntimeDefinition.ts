import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'streamchat',
  // Chat arrives from the main process, which owns the Twitch and YouTube
  // connections, so an OBS browser source needs no network access of its own.
  channels: ['streamchat.messages', 'streamchat.emotes'],
  channelRates: {
    // Messages arrive a few at a time; the snapshot carries the whole buffer,
    // so a coarse rate drops nothing.
    'streamchat.messages': 5,
    'streamchat.emotes': 1,
  },
} satisfies WidgetRuntimeDefinition;
