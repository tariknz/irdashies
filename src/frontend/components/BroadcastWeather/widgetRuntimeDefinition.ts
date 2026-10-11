import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'broadcastweather',
  sessionData: true,
  channels: ['session-bar.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
