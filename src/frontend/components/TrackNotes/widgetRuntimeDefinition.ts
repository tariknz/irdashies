import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tracknotes',
  sessionData: true,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
