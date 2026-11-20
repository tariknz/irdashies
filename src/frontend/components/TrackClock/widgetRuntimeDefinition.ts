import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'trackclock',
  sessionData: true,
  channels: ['session-bar.snapshot', 'track-state.snapshot'],
  ratePreset: 'informational',
} satisfies WidgetRuntimeDefinition;
