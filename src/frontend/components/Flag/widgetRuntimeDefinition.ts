import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'flag',
  sessionData: true,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
