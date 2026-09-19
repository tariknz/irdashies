import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'trackclock',
  channels: ['session-bar.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
