import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'slowcarahead',
  sessionData: true,
  channels: ['car-speeds.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'car-speeds.snapshot': 10 },
} satisfies WidgetRuntimeDefinition;
