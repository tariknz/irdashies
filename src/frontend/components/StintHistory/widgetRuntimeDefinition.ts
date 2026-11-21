import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'stinthistory',
  sessionData: true,
  channels: ['fuel.projection', 'track-state.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
