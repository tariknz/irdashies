import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { LayoutNode } from '@irdashies/types';
import { LayoutVisualizer } from './LayoutVisualizer';

const meta = {
  component: LayoutVisualizer,
  decorators: [
    (Story) => (
      <div className="settings-shell bg-slate-900 p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LayoutVisualizer>;
export default meta;
type Story = StoryObj;
export const InputLayout: Story = {
  render: () => {
    const [tree, setTree] = useState<LayoutNode>({
      id: 'root',
      type: 'box',
      direction: 'row',
      widgets: ['throttle', 'brake', 'gear'],
    });
    return (
      <LayoutVisualizer
        tree={tree}
        onChange={setTree}
        availableWidgets={[
          { id: 'throttle', label: 'Throttle' },
          { id: 'brake', label: 'Brake' },
          { id: 'gear', label: 'Gear' },
          { id: 'steer', label: 'Steering' },
        ]}
      />
    );
  },
};
