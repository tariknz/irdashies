import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'infobar',
  legacyTelemetry: true,
  channels: ['session-timing.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
