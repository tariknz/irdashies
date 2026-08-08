import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'infobar',
  legacyTelemetry: true,
  channels: ['session-timing.snapshot', 'session-bar.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
