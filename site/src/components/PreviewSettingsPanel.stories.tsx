import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '../../../.storybook/mockDashboardBridge';
import { PreviewSettingsButton } from './PreviewSettingsPanel';

const meta = {
  title: 'Site/Preview settings',
  component: PreviewSettingsButton,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <DashboardProvider bridge={mockDashboardBridge}>
        <div className="min-h-screen bg-slate-900 p-4">
          <Story />
        </div>
      </DashboardProvider>
    ),
  ],
} satisfies Meta<typeof PreviewSettingsButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Standings: Story = {
  args: { openToWidget: 'standings' },
};

export const General: Story = {
  args: { openToWidget: 'general' },
};
