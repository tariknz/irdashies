import type {
  DashboardLayout,
  GantryConfig,
  GantryWindowBounds,
  GantryWindowConfig,
} from '@irdashies/types';
import { isValidRect } from './windowBounds';

export interface GantryWindowPlacement {
  bounds: GantryWindowBounds;
  maximized: boolean;
}

const gantryConfig = (
  dashboard: DashboardLayout | undefined | null
): Partial<GantryConfig> | undefined =>
  dashboard?.widgets.find((widget) => widget.id === 'gantry')?.config as
    Partial<GantryConfig> | undefined;

const windowConfig = (
  config: Partial<GantryConfig> | undefined
): Partial<GantryWindowConfig> => {
  const window: unknown = config?.window;
  return window && typeof window === 'object' && !Array.isArray(window)
    ? (window as Partial<GantryWindowConfig>)
    : {};
};

export const readGantryWindowPlacement = (
  dashboard: DashboardLayout | undefined | null
): { bounds: unknown; maximized: boolean } => {
  const window = windowConfig(gantryConfig(dashboard));
  return {
    bounds: window.bounds,
    maximized: window.maximized === true,
  };
};

const roundBounds = (bounds: GantryWindowBounds): GantryWindowBounds => ({
  x: Math.round(bounds.x),
  y: Math.round(bounds.y),
  width: Math.round(bounds.width),
  height: Math.round(bounds.height),
});

export const withGantryWindowPlacement = (
  dashboard: DashboardLayout,
  placement: GantryWindowPlacement
): DashboardLayout | null => {
  if (!isValidRect(placement.bounds)) return null;
  const config = gantryConfig(dashboard);
  if (!config) return null;
  const window = windowConfig(config);

  const bounds = roundBounds(placement.bounds);
  const saved = window.bounds;
  if (
    saved?.x === bounds.x &&
    saved.y === bounds.y &&
    saved.width === bounds.width &&
    saved.height === bounds.height &&
    (window.maximized === true) === placement.maximized
  ) {
    return null;
  }

  return {
    ...dashboard,
    widgets: dashboard.widgets.map((widget) =>
      widget.id === 'gantry'
        ? {
            ...widget,
            config: {
              ...widget.config,
              window: {
                ...window,
                alwaysOnTop: window.alwaysOnTop === true,
                bounds,
                maximized: placement.maximized,
              },
            },
          }
        : widget
    ),
  };
};
