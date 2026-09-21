import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tyrepanel',
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
