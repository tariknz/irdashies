import { Decorator } from '@storybook/react-vite';
import { DashboardProvider, SessionProvider, TelemetryProvider } from '@irdashies/context';
import { generateMockDataFromPath } from '../src/app/bridge/iracingSdk/mock-data/generateMockData';
import { mockDashboardBridge } from './mockDashboardBridge';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';
import { defaultDashboard } from '../src/app/storage/defaultDashboard';
import type { ComponentType } from 'react';

// eslint-disable-next-line react/display-name
export const TelemetryDecorator: (path?: string) => Decorator = (path) => (Story) => (
  <>
    <SessionProvider bridge={generateMockDataFromPath(path)} />
    <TelemetryProvider bridge={generateMockDataFromPath(path)} />
    <DashboardProvider bridge={mockDashboardBridge}>
      <Story />
    </DashboardProvider>
  </>
);

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
        // No-op cleanup function
      };
    },
  };
};

export const TelemetryDecoratorWithConfig: (
  path?: string,
  widgetConfigOverrides?: Record<string, Record<string, unknown>>
) => Decorator = (path, widgetConfigOverrides = {}) => {
  const DecoratorComponent = (Story: ComponentType) => {
    const bridge = widgetConfigOverrides
      ? createMockBridgeWithConfig(widgetConfigOverrides)
      : mockDashboardBridge;

    return (
      <>
        <SessionProvider bridge={generateMockDataFromPath(path)} />
        <TelemetryProvider bridge={generateMockDataFromPath(path)} />
        <DashboardProvider bridge={bridge}>
          <Story />
        </DashboardProvider>
      </>
    );
  };

  DecoratorComponent.displayName = 'TelemetryDecoratorWithConfig';
  return DecoratorComponent;
};
