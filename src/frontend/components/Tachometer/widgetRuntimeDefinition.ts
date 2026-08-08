import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tachometer',
  legacyTelemetry: false,
  sessionData: true,
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
