import { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import { SettingsLayout } from './SettingsLayout';
import { mockDashboardBridge } from './__mocks__/mockBridge';

interface StoryProps {
  initialPath: string;
}

const meta: Meta<typeof SettingsLayout> = {
  component: SettingsLayout,
  decorators: [
    (Story, context) => {
      const { initialPath = 'standings' } =
        context.args as StoryProps;
      return (
        <DashboardProvider bridge={mockDashboardBridge}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route
                path="/settings/*"
                element={
                  <div style={{ height: '100vh' }}>
                    <Story />
                  </div>
                }
              />
            </Routes>
          </MemoryRouter>
        </DashboardProvider>
      );
    },
  ],
};

export default meta;

type Story = StoryObj<typeof SettingsLayout>;

export const Default: Story = {
  args: {
    initialPath: '/settings/standings',
  },
};

// Add more stories for different routes
export const RelativeRoute: Story = {
  args: {
    initialPath: '/settings/relative',
  },
};

export const WeatherRoute: Story = {
  args: {
    initialPath: '/settings/weather',
  },
};
