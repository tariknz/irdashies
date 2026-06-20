import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import { KeybindingsSettings } from './KeybindingsSettings';

const meta: Meta<typeof KeybindingsSettings> = {
  component: KeybindingsSettings,
  title: 'components/Settings/KeybindingsSettings',
  decorators: [
    (Story) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <div style={{ height: '100vh', width: '600px' }}>
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof KeybindingsSettings>;

export const Default: Story = {};
