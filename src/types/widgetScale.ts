export const WIDGET_SCALE = {
  default: 100,
  min: 50,
  max: 200,
  step: 5,
} as const;

/** Persisted settings and browser sources may contain invalid values. */
export const normalizeWidgetScale = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(WIDGET_SCALE.max, Math.max(WIDGET_SCALE.min, value))
    : WIDGET_SCALE.default;
