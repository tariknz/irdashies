import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'infobar',
  sessionData: true,
  channels: ['session-timing.snapshot', 'session-bar.snapshot'],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
