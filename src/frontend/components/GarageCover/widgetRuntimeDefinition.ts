import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'garagecover',
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
