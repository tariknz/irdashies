import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'blindspotmonitor',
  sessionData: true,
  channels: ['track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
