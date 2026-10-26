import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'stintplan',
  channels: ['race-plan.progress'],
  // The channel publishes once a second.
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
