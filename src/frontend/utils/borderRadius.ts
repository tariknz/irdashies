import type { CSSProperties } from 'react';
import type {
  BorderRadiusCorners,
  GeneralSettingsType,
  WidgetConfigMap,
  WidgetBorderRadiusSettings,
} from '@irdashies/types';

export const DEFAULT_BORDER_RADIUS = 2;
export const MAX_BORDER_RADIUS = 32;

export const DEFAULT_BORDER_RADIUS_CORNERS: BorderRadiusCorners = {
  topLeft: DEFAULT_BORDER_RADIUS,
  topRight: DEFAULT_BORDER_RADIUS,
  bottomRight: DEFAULT_BORDER_RADIUS,
  bottomLeft: DEFAULT_BORDER_RADIUS,
};

export const DEFAULT_WIDGET_BORDER_RADIUS: WidgetBorderRadiusSettings = {
  mode: 'inherit',
};

export const WIDGET_BORDER_RADIUS_CLASS = 'widget-radius-clip';
export const WIDGET_BORDER_RADIUS_SURFACE_CLASS = 'widget-radius-surface';

export const WIDGET_BORDER_RADIUS_SUPPORTED_TYPES = [
  'standings',
  'relative',
  'weather',
  'wind',
  'input',
  'fuel',
  'garagecover',
  'rejoin',
  'flag',
  'fastercarsfrombehind',
  'pitlanehelper',
  'twitchchat',
  'laptimelog',
  'infobar',
  'sectordelta',
  'cornername',
] as const satisfies readonly (keyof WidgetConfigMap)[];

export type WidgetBorderRadiusSupportedType =
  (typeof WIDGET_BORDER_RADIUS_SUPPORTED_TYPES)[number];

const WIDGET_BORDER_RADIUS_SUPPORTED_TYPE_SET = new Set<string>(
  WIDGET_BORDER_RADIUS_SUPPORTED_TYPES
);

const BORDER_RADIUS_MODES = new Set<WidgetBorderRadiusSettings['mode']>([
  'inherit',
  'uniform',
  'corners',
]);

export const supportsWidgetBorderRadius = (
  widgetType: string | undefined
): widgetType is WidgetBorderRadiusSupportedType =>
  typeof widgetType === 'string' &&
  WIDGET_BORDER_RADIUS_SUPPORTED_TYPE_SET.has(widgetType);

export const clampBorderRadius = (value: number | undefined): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_BORDER_RADIUS;
  }

  return Math.min(MAX_BORDER_RADIUS, Math.max(0, Math.round(value)));
};

export const normalizeBorderRadiusCorners = (
  corners: WidgetBorderRadiusSettings['corners'] | undefined,
  fallback: BorderRadiusCorners = DEFAULT_BORDER_RADIUS_CORNERS
): BorderRadiusCorners => ({
  topLeft: clampBorderRadius(corners?.topLeft ?? fallback.topLeft),
  topRight: clampBorderRadius(corners?.topRight ?? fallback.topRight),
  bottomRight: clampBorderRadius(corners?.bottomRight ?? fallback.bottomRight),
  bottomLeft: clampBorderRadius(corners?.bottomLeft ?? fallback.bottomLeft),
});

export const normalizeWidgetBorderRadiusSettings = (
  settings: WidgetBorderRadiusSettings | undefined
): WidgetBorderRadiusSettings => {
  if (!settings || !BORDER_RADIUS_MODES.has(settings.mode)) {
    return DEFAULT_WIDGET_BORDER_RADIUS;
  }

  if (settings.mode === 'inherit') {
    return DEFAULT_WIDGET_BORDER_RADIUS;
  }

  if (settings.mode === 'uniform') {
    return {
      mode: 'uniform',
      radius: clampBorderRadius(settings.radius),
    };
  }

  return {
    mode: 'corners',
    corners: normalizeBorderRadiusCorners(settings.corners),
  };
};

const createBorderRadiusStyle = (
  corners: BorderRadiusCorners
): CSSProperties => ({
  borderTopLeftRadius: corners.topLeft,
  borderTopRightRadius: corners.topRight,
  borderBottomRightRadius: corners.bottomRight,
  borderBottomLeftRadius: corners.bottomLeft,
  ['--widget-border-radius-top-left' as string]: `${corners.topLeft}px`,
  ['--widget-border-radius-top-right' as string]: `${corners.topRight}px`,
  ['--widget-border-radius-bottom-right' as string]: `${corners.bottomRight}px`,
  ['--widget-border-radius-bottom-left' as string]: `${corners.bottomLeft}px`,
});

export const getWidgetBorderRadiusStyle = (
  settings: WidgetBorderRadiusSettings | undefined,
  generalSettings: GeneralSettingsType | undefined
): CSSProperties => {
  const normalizedSettings = normalizeWidgetBorderRadiusSettings(settings);
  const globalRadius = clampBorderRadius(generalSettings?.borderRadius);

  if (normalizedSettings.mode === 'inherit') {
    return createBorderRadiusStyle({
      topLeft: globalRadius,
      topRight: globalRadius,
      bottomRight: globalRadius,
      bottomLeft: globalRadius,
    });
  }

  if (normalizedSettings.mode === 'uniform') {
    const radius = clampBorderRadius(normalizedSettings.radius);
    return {
      borderRadius: radius,
      ...createBorderRadiusStyle({
        topLeft: radius,
        topRight: radius,
        bottomRight: radius,
        bottomLeft: radius,
      }),
    };
  }

  return createBorderRadiusStyle(
    normalizeBorderRadiusCorners(normalizedSettings.corners)
  );
};
