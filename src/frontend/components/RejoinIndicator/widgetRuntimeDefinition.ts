import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'rejoin',
  legacyTelemetry: true,
  channels: ['relative-gaps.snapshot', 'standings.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
