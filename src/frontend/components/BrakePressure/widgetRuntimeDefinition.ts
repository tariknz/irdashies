import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'brakepressure',
  channels: ['driver-controls.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
