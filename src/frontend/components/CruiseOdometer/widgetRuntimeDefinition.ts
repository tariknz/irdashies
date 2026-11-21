import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'cruiseodometer',
  sessionData: true,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
