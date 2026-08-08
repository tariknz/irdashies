import { createContext, type ReactNode, useContext, useMemo } from 'react';
import type { ChannelName, DashboardWidget } from '@irdashies/types';

export type WidgetRatePreset =
  'driverFocused' | 'gapTiming' | 'informational' | 'static';

const RATE_PRESETS: Readonly<Record<WidgetRatePreset, number | undefined>> = {
  driverFocused: 25,
  gapTiming: 5,
  informational: 1,
  static: undefined,
};

export interface WidgetRuntimeDefinition {
  id: string;
  legacyTelemetry?: boolean;
  sessionData?: boolean;
  pitLaneData?: boolean;
  channels?: readonly ChannelName[];
  ratePreset?: WidgetRatePreset;
  channelRates?: Partial<Record<ChannelName, number>>;
}

interface WidgetRuntimeModule {
  default: WidgetRuntimeDefinition;
}

const discoveredDefinitions = import.meta.glob<WidgetRuntimeModule>(
  './components/*/widgetRuntimeDefinition.ts',
  { eager: true }
);

const definitions = new Map<string, WidgetRuntimeDefinition>();
for (const module of Object.values(discoveredDefinitions)) {
  definitions.set(module.default.id, module.default);
}

const LEGACY_DEFINITION: WidgetRuntimeDefinition = {
  id: 'legacy',
  legacyTelemetry: true,
};

export const getWidgetRuntimeDefinition = (
  widgetType: string
): WidgetRuntimeDefinition => definitions.get(widgetType) ?? LEGACY_DEFINITION;

export const widgetUsesLegacyTelemetry = (widget: DashboardWidget): boolean =>
  getWidgetRuntimeDefinition(widget.type || widget.id).legacyTelemetry !==
  false;

export const rendererNeedsLegacyTelemetry = (
  widgets: readonly DashboardWidget[]
): boolean => widgets.some(widgetUsesLegacyTelemetry);

export const rendererNeedsChannel = (
  widgets: readonly DashboardWidget[],
  channel: ChannelName
): boolean =>
  widgets.some((widget) =>
    getWidgetRuntimeDefinition(widget.type || widget.id).channels?.includes(
      channel
    )
  );

export const rendererNeedsSessionData = (
  widgets: readonly DashboardWidget[]
): boolean =>
  widgets.some(
    (widget) =>
      getWidgetRuntimeDefinition(widget.type || widget.id).sessionData === true
  );

export const rendererNeedsPitLaneData = (
  widgets: readonly DashboardWidget[]
): boolean =>
  widgets.some(
    (widget) =>
      getWidgetRuntimeDefinition(widget.type || widget.id).pitLaneData === true
  );

const WidgetRuntimeContext = createContext<WidgetRuntimeDefinition | undefined>(
  undefined
);

export const WidgetRuntimeProvider = ({
  widgetType,
  children,
}: {
  widgetType: string;
  children: ReactNode;
}) => {
  const definition = getWidgetRuntimeDefinition(widgetType);
  return (
    <WidgetRuntimeContext.Provider value={definition}>
      {children}
    </WidgetRuntimeContext.Provider>
  );
};

export const useWidgetChannelRate = (
  channel: ChannelName
): number | undefined => {
  const definition = useContext(WidgetRuntimeContext);
  return useMemo(() => {
    const override = definition?.channelRates?.[channel];
    if (override !== undefined) return override;
    return definition?.ratePreset
      ? RATE_PRESETS[definition.ratePreset]
      : undefined;
  }, [channel, definition]);
};
