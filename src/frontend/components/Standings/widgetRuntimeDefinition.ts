import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'standings',
  legacyTelemetry: true,
  channels: [
    'lap-times.snapshot',
    'reference-laps.snapshot',
    'standings.snapshot',
  ],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
