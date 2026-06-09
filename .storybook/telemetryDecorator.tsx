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
import { defaultDashboard } from '../src/app/storage/defaultDashboard';
import type { ComponentType } from 'react';

export const TelemetryDecorator: (path?: string) => Decorator = (path) => {
  const DecoratorComponent = (Story: ComponentType) => (
    <>
      <SessionProvider bridge={generateMockDataFromPath(path)} />
      <TelemetryProvider bridge={generateMockDataFromPath(path)} />
      <DashboardProvider bridge={mockDashboardBridge}>
        <RunningStateProvider bridge={generateMockDataFromPath(path)}>
          <Story />
        </RunningStateProvider>
      </DashboardProvider>
    </>
  );
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
