import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'battle',
  sessionData: true,
  channels: [
    'car-speeds.snapshot',
    'relative-gaps.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'driverFocused',
  channelRates: { 'car-speeds.snapshot': 10, 'standings.snapshot': 5 },
} satisfies WidgetRuntimeDefinition;
