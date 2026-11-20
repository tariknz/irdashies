import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'damage',
  sessionData: true,
  channels: ['car-condition.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
