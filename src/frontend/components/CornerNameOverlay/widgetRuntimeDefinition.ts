import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'cornername',
  legacyTelemetry: false,
  sessionData: true,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
