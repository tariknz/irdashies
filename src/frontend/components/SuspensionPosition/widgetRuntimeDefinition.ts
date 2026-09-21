import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'suspensionposition',
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
