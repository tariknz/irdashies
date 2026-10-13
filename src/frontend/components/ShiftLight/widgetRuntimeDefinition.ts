import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'shiftlight',
  sessionData: true,
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
