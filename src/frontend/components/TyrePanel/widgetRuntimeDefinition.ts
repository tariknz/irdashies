import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tyrepanel',
  sessionData: true,
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
