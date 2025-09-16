import type { Decorator } from '@storybook/react-vite';
import { DashboardProvider, SessionProvider, TelemetryProvider } from '@irdashies/context';
import { generateMockDataFromPath } from '../src/app/bridge/iracingSdk/mock-data/generateMockData';
import { mockDashboardBridge } from './mockDashboardBridge';
import { MemoryRouter } from 'react-router-dom';

// eslint-disable-next-line react/display-name
export const TelemetryDecorator: (path?: string) => Decorator = (path) => (Story) => (
  <>
    <MemoryRouter>
      <SessionProvider bridge={generateMockDataFromPath(path)} />
      <TelemetryProvider bridge={generateMockDataFromPath(path)} />
      <DashboardProvider bridge={mockDashboardBridge}>
        <Story />
      </DashboardProvider>
    </MemoryRouter>
  </>
);
