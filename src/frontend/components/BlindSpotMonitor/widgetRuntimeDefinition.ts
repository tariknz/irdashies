import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'blindspotmonitor',
  sessionData: true,
  channels: ['blind-spot.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'blind-spot.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
