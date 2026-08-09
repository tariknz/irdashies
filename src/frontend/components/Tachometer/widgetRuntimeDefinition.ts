import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'tachometer',
  sessionData: true,
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
