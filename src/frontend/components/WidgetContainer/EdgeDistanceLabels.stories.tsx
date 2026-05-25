import type { Meta, StoryObj } from '@storybook/react-vite';
import { EdgeDistanceLabels } from './EdgeDistanceLabels';

const meta: Meta<typeof EdgeDistanceLabels> = {
  title: 'WidgetContainer/EdgeDistanceLabels',
  component: EdgeDistanceLabels,
  parameters: {
    layout: 'centered',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const WidgetFrame = ({ children }: { children: React.ReactNode }) => (
  <div
    style={{
      position: 'relative',
      width: 220,
      height: 100,
      border: '2px solid #38bdf8',
      background: 'rgba(15,23,42,0.8)',
    }}
  >
    {children}
  </div>
);

export const MidScreen: Story = {
  render: (args) => (
    <WidgetFrame>
      <EdgeDistanceLabels {...args} />
    </WidgetFrame>
  ),
  args: {
    distances: { left: 340, top: 180, right: 820, bottom: 620 },
  },
};

export const NearTopLeft: Story = {
  render: (args) => (
    <WidgetFrame>
      <EdgeDistanceLabels {...args} />
    </WidgetFrame>
  ),
  args: {
    distances: { left: 8, top: 8, right: 1692, bottom: 1072 },
  },
};

export const AtEdge: Story = {
  render: (args) => (
    <WidgetFrame>
      <EdgeDistanceLabels {...args} />
    </WidgetFrame>
  ),
  args: {
    distances: { left: 0, top: 0, right: 0, bottom: 0 },
  },
};
