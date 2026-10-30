import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'damage',
  channels: ['driver-controls.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
