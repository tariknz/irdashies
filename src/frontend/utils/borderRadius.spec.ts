import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BORDER_RADIUS,
  WIDGET_BORDER_RADIUS_SUPPORTED_TYPES,
  clampBorderRadius,
  getWidgetBorderRadiusStyle,
  normalizeBorderRadiusCorners,
  normalizeWidgetBorderRadiusSettings,
  supportsWidgetBorderRadius,
} from './borderRadius';

describe('borderRadius utilities', () => {
  const expectedCornerStyle = (
    topLeft: number,
    topRight: number,
    bottomRight: number,
    bottomLeft: number
  ) => ({
    borderTopLeftRadius: topLeft,
    borderTopRightRadius: topRight,
    borderBottomRightRadius: bottomRight,
    borderBottomLeftRadius: bottomLeft,
    '--widget-border-radius-top-left': `${topLeft}px`,
    '--widget-border-radius-top-right': `${topRight}px`,
    '--widget-border-radius-bottom-right': `${bottomRight}px`,
    '--widget-border-radius-bottom-left': `${bottomLeft}px`,
  });

  it('clamps missing and invalid values to the default', () => {
    expect(clampBorderRadius(undefined)).toBe(DEFAULT_BORDER_RADIUS);
    expect(clampBorderRadius(Number.NaN)).toBe(DEFAULT_BORDER_RADIUS);
    expect(clampBorderRadius(Number.POSITIVE_INFINITY)).toBe(
      DEFAULT_BORDER_RADIUS
    );
  });

  it('clamps values to the supported range', () => {
    expect(clampBorderRadius(-4)).toBe(0);
    expect(clampBorderRadius(12.4)).toBe(12);
    expect(clampBorderRadius(48)).toBe(32);
  });

  it('allows border radius only for supported user-facing widgets', () => {
    expect(WIDGET_BORDER_RADIUS_SUPPORTED_TYPES).toContain('standings');
    expect(supportsWidgetBorderRadius('standings')).toBe(true);
    expect(supportsWidgetBorderRadius('fuel')).toBe(true);
    expect(supportsWidgetBorderRadius('wind')).toBe(true);
    expect(supportsWidgetBorderRadius('cornername')).toBe(true);
    expect(supportsWidgetBorderRadius('tachometer')).toBe(false);
    expect(supportsWidgetBorderRadius('telemetryinspector')).toBe(false);
    expect(supportsWidgetBorderRadius('map')).toBe(false);
    expect(supportsWidgetBorderRadius('flatmap')).toBe(false);
    expect(supportsWidgetBorderRadius('blindspotmonitor')).toBe(false);
    expect(supportsWidgetBorderRadius('slowcarahead')).toBe(false);
    expect(supportsWidgetBorderRadius('unknown-widget')).toBe(false);
    expect(supportsWidgetBorderRadius(undefined)).toBe(false);
  });

  it('normalizes partial corner values', () => {
    expect(
      normalizeBorderRadiusCorners({
        topLeft: 0,
        bottomRight: 48,
      })
    ).toEqual({
      topLeft: 0,
      topRight: 2,
      bottomRight: 32,
      bottomLeft: 2,
    });
  });

  it('normalizes missing and invalid widget settings to inherit mode', () => {
    expect(normalizeWidgetBorderRadiusSettings(undefined)).toEqual({
      mode: 'inherit',
    });
    expect(
      normalizeWidgetBorderRadiusSettings({
        mode: 'unknown',
      } as never)
    ).toEqual({
      mode: 'inherit',
    });
  });

  it('uses global radius when a widget inherits radius settings', () => {
    expect(getWidgetBorderRadiusStyle(undefined, { borderRadius: 8 })).toEqual({
      ...expectedCornerStyle(8, 8, 8, 8),
    });

    expect(
      getWidgetBorderRadiusStyle({ mode: 'inherit' }, { borderRadius: 6 })
    ).toEqual({
      ...expectedCornerStyle(6, 6, 6, 6),
    });
  });

  it('uses a uniform widget radius override', () => {
    expect(
      getWidgetBorderRadiusStyle(
        { mode: 'uniform', radius: 10 },
        { borderRadius: 4 }
      )
    ).toEqual({
      borderRadius: 10,
      ...expectedCornerStyle(10, 10, 10, 10),
    });
  });

  it('uses per-corner widget radius overrides', () => {
    expect(
      getWidgetBorderRadiusStyle(
        {
          mode: 'corners',
          corners: {
            topLeft: 0,
            topRight: 4,
            bottomRight: 8,
            bottomLeft: 12,
          },
        },
        { borderRadius: 4 }
      )
    ).toEqual({
      ...expectedCornerStyle(0, 4, 8, 12),
    });
  });
});
