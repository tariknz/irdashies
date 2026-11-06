import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ReorderControls } from './ReorderControls';

const meta: Meta<typeof ReorderControls> = {
  component: ReorderControls,
  title: 'components/Settings/ReorderControls',
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => {
    const [position, setPosition] = useState(2);
    return (
      <div className="settings-shell flex items-center gap-4 bg-slate-900 p-4 text-slate-200">
        <span>Session Time: position {position} of 3</span>
        <ReorderControls
          label="Session Time"
          position={position}
          total={3}
          onMoveUp={position > 1 ? () => setPosition(position - 1) : undefined}
          onMoveDown={
            position < 3 ? () => setPosition(position + 1) : undefined
          }
        />
      </div>
    );
  },
};
