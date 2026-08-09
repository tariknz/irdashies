import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'laptimelog',
  sessionData: true,
  channels: ['lap-log.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
