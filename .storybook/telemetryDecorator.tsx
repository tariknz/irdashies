import { Decorator } from '@storybook/react-vite';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  TelemetryProvider,
} from '@irdashies/context';
import { generateMockDataFromPath } from '../src/app/bridge/iracingSdk/mock-data/generateMockData';
import { mockDashboardBridge } from './mockDashboardBridge';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import type { ComponentType } from 'react';
import { useMemo } from 'react';
import { useGlobals } from 'storybook/preview-api';

const makeBridgeWithSettings = (compactMode: string): DashboardBridge => {
  const dashboard: DashboardLayout = {
    ...defaultDashboard,
    generalSettings: {
      ...defaultDashboard.generalSettings,
      compactMode: compactMode as 'off' | 'compact' | 'ultra',
    },
  };
  return {
    ...mockDashboardBridge,
    resetDashboard: async () => dashboard,
    dashboardUpdated: (callback) => {
      callback(dashboard, undefined);
      return () => {
        // noop
      };
    },
  };
};

export const TelemetryDecorator: (path?: string) => Decorator = (path) => {
  const DecoratorComponent = (Story: ComponentType) => {
    const [globals] = useGlobals();
    const compactMode = (globals?.compactMode as string) ?? 'off';
    const bridge = useMemo(() => makeBridgeWithSettings(compactMode), [compactMode]);
    return (
      <>
        <SessionProvider bridge={generateMockDataFromPath(path)} />
        <TelemetryProvider bridge={generateMockDataFromPath(path)} />
        <DashboardProvider bridge={bridge}>
          <RunningStateProvider bridge={generateMockDataFromPath(path)}>
            <Story />
          </RunningStateProvider>
        </DashboardProvider>
      </>
    );
  };
  DecoratorComponent.displayName = 'TelemetryDecorator';
  return DecoratorComponent;
};

export const createMockBridgeWithConfig = (
  widgetConfigOverrides: Record<string, Record<string, unknown>>
): DashboardBridge => {
  const modifiedDashboard: DashboardLayout = {
    ...defaultDashboard,
    widgets: defaultDashboard.widgets.map((widget) => {
      const configOverride = widgetConfigOverrides[widget.id];
      if (configOverride) {
        return {
          ...widget,
          config: {
            ...widget.config,
            ...configOverride,
          },
        };
      }
      return widget;
    }),
  };

  return {
    ...mockDashboardBridge,
    resetDashboard: async () => modifiedDashboard,
    dashboardUpdated: (callback) => {
      callback(modifiedDashboard, undefined);
      return () => {
        // noop
      };
    },
  };
};

export const TelemetryDecoratorWithConfig: (
  path?: string,
  widgetConfigOverrides?: Record<string, Record<string, unknown>>
) => Decorator = (path, widgetConfigOverrides = {}) => {
  // Created once per decorator instance — stable reference across renders
  const baseConfigBridge = createMockBridgeWithConfig(widgetConfigOverrides);

  const DecoratorComponent = (Story: ComponentType) => {
    const [globals] = useGlobals();
    const compactMode = (globals?.compactMode as string) ?? 'off';

    const bridge = useMemo(
      (): DashboardBridge => ({
        ...baseConfigBridge,
        resetDashboard: async () => {
          const dashboard = await baseConfigBridge.resetDashboard(false);
          return {
            ...dashboard,
            generalSettings: {
              ...dashboard.generalSettings,
              compactMode: compactMode as 'off' | 'compact' | 'ultra',
            },
          };
        },
        dashboardUpdated: (callback) => {
          return baseConfigBridge.dashboardUpdated((dashboard, prev) => {
            callback(
              {
                ...dashboard,
                generalSettings: {
                  ...dashboard.generalSettings,
                  compactMode: compactMode as 'off' | 'compact' | 'ultra',
                },
              },
              prev
            );
          });
        },
      }),
      [compactMode]
    );

    return (
      <>
        <SessionProvider bridge={generateMockDataFromPath(path)} />
        <TelemetryProvider bridge={generateMockDataFromPath(path)} />
        <DashboardProvider bridge={bridge}>
          <RunningStateProvider bridge={generateMockDataFromPath(path)}>
            <Story />
          </RunningStateProvider>
        </DashboardProvider>
      </>
    );
  };

  DecoratorComponent.displayName = 'TelemetryDecoratorWithConfig';
  return DecoratorComponent;
};
