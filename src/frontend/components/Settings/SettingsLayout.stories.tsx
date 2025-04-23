import { Meta, StoryObj } from '@storybook/react';
import { HashRouter } from 'react-router-dom';
import { DashboardProvider } from '@irdashies/context';
import { SettingsLayout } from './SettingsLayout';
import { mockDashboardBridge } from './__mocks__/mockBridge';

const meta: Meta<typeof SettingsLayout> = {
  component: SettingsLayout,
  decorators: [
    (Story) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <HashRouter>
          <div style={{ height: '100vh' }}>
            <Story />
          </div>
        </HashRouter>
      </DashboardProvider>
    ),
  ],
};

export default meta;

export const Default: StoryObj<typeof SettingsLayout> = {};
