import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tyrepanel',
  sessionData: true,
  channels: ['car-condition.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
