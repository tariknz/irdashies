import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'fuel',
  channels: ['fuel.projection'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
