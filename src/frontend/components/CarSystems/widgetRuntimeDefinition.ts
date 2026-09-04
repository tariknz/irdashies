import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'carsystems',
  sessionData: false,
  // track-state carries the driving state the widget uses to hide itself.
  channels: ['car-systems.snapshot', 'track-state.snapshot'],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
