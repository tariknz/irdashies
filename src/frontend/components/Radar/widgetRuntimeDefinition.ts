import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'radar',
  sessionData: true,
  channels: ['radar.snapshot'],
  ratePreset: 'driverFocused',
  channelRates: { 'radar.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
