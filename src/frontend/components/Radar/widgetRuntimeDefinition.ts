import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'radar',
  sessionData: true,
  channels: ['blind-spot.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'blind-spot.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
