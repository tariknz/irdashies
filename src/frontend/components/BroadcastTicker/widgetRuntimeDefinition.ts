import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'broadcastticker',
  sessionData: true,
  channels: ['standings.snapshot', 'track-state.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
