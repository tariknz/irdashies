import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'carsystems',
  // The widget's session-visibility settings resolve the current session type
  // through SessionStore, which RendererDataProviders only mounts when a widget
  // in the window asks for session data. Without this the practice/qualifying/
  // race toggles silently do nothing in a window holding only this widget.
  sessionData: true,
  // track-state carries the driving state the widget uses to hide itself.
  channels: ['car-systems.snapshot', 'track-state.snapshot'],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
