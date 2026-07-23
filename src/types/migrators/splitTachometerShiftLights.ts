import type {
  DashboardLayout,
  DashboardWidget,
  WidgetLayout,
} from '../dashboardLayout';
import { getWidgetDefaultConfig } from '../defaultDashboard';
import type {
  ShiftLightsConfig,
  ShiftPointSettings,
  TachometerConfig,
} from '../widgetConfigs';

export interface SplitTachometerMigrationResult {
  dashboard: DashboardLayout;
  changed: boolean;
  invalidShiftPointSettings: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const isLayout = (value: unknown): value is WidgetLayout =>
  isRecord(value) &&
  ['x', 'y', 'width', 'height'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key])
  );

const isShiftPointSettings = (value: unknown): value is ShiftPointSettings => {
  if (
    !isRecord(value) ||
    typeof value.enabled !== 'boolean' ||
    !['glow', 'pulse', 'border'].includes(String(value.indicatorType)) ||
    typeof value.indicatorColor !== 'string' ||
    !isRecord(value.carConfigs)
  ) {
    return false;
  }

  return Object.values(value.carConfigs).every((car) => {
    if (
      !isRecord(car) ||
      typeof car.enabled !== 'boolean' ||
      typeof car.carId !== 'string' ||
      typeof car.carName !== 'string' ||
      typeof car.gearCount !== 'number' ||
      typeof car.redlineRpm !== 'number' ||
      !isRecord(car.gearShiftPoints)
    ) {
      return false;
    }

    return Object.values(car.gearShiftPoints).every(
      (point) =>
        isRecord(point) &&
        typeof point.shiftRpm === 'number' &&
        Number.isFinite(point.shiftRpm)
    );
  });
};

const shiftLightsIdFor = (widget: DashboardWidget): string =>
  widget.id === 'tachometer' ? 'shiftlights' : `${widget.id}-shiftlights`;

const cleanTachometerConfig = (
  config: Record<string, unknown>
): TachometerConfig & Record<string, unknown> => {
  const remaining = Object.fromEntries(
    Object.entries(config).filter(
      ([key]) => !['shiftPointSettings', 'shiftPointStyle'].includes(key)
    )
  );

  return {
    ...remaining,
    version: 2,
  } as TachometerConfig & Record<string, unknown>;
};

export const migrateSplitTachometerShiftLights = (
  value: unknown
): SplitTachometerMigrationResult => {
  if (!isRecord(value) || !Array.isArray(value.widgets)) {
    return {
      dashboard: value as DashboardLayout,
      changed: false,
      invalidShiftPointSettings: false,
    };
  }

  const dashboard = value as unknown as DashboardLayout;
  const widgets = [...dashboard.widgets];
  let changed = false;
  let invalidShiftPointSettings = false;

  for (let index = 0; index < widgets.length; index++) {
    const widget = widgets[index];
    if (
      (widget.type ?? widget.id) !== 'tachometer' ||
      !isLayout(widget.layout)
    ) {
      continue;
    }

    const config = isRecord(widget.config) ? widget.config : {};
    const destinationId = shiftLightsIdFor(widget);
    const existingShiftLights = widgets.find(
      (candidate) =>
        candidate.id === destinationId ||
        (widget.id === 'tachometer' &&
          (candidate.type ?? candidate.id) === 'shiftlights')
    );

    if (!existingShiftLights) {
      const defaults = structuredClone(getWidgetDefaultConfig('shiftlights'));
      const savedShiftPointSettings = config.shiftPointSettings;
      const shiftPointSettings = isShiftPointSettings(savedShiftPointSettings)
        ? structuredClone(savedShiftPointSettings)
        : defaults.shiftPointSettings;

      if (
        savedShiftPointSettings !== undefined &&
        !isShiftPointSettings(savedShiftPointSettings)
      ) {
        invalidShiftPointSettings = true;
      }

      const shiftLightsConfig: ShiftLightsConfig = {
        ...defaults,
        background: isRecord(config.background)
          ? {
              opacity:
                typeof config.background.opacity === 'number'
                  ? config.background.opacity
                  : defaults.background.opacity,
            }
          : defaults.background,
        showOnlyWhenOnTrack:
          typeof config.showOnlyWhenOnTrack === 'boolean'
            ? config.showOnlyWhenOnTrack
            : defaults.showOnlyWhenOnTrack,
        sessionVisibility: isRecord(config.sessionVisibility)
          ? {
              ...defaults.sessionVisibility,
              ...config.sessionVisibility,
            }
          : defaults.sessionVisibility,
        shiftPointSettings,
      };

      widgets.push({
        id: destinationId,
        type: widget.id === 'tachometer' ? undefined : 'shiftlights',
        enabled: widget.enabled,
        layout: { ...widget.layout },
        config: shiftLightsConfig as unknown as Record<string, unknown>,
      });
      changed = true;
    }

    const needsCleanup =
      config.version !== 2 ||
      'shiftPointSettings' in config ||
      'shiftPointStyle' in config;
    if (needsCleanup) {
      widgets[index] = {
        ...widget,
        config: cleanTachometerConfig(config),
      };
      changed = true;
    }
  }

  if (!changed) {
    return { dashboard, changed: false, invalidShiftPointSettings: false };
  }

  return {
    dashboard: { ...dashboard, widgets },
    changed: true,
    invalidShiftPointSettings,
  };
};
