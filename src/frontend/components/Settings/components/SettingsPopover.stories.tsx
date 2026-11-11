import type { Meta, StoryObj } from '@storybook/react-vite';
import { useRef, useState } from 'react';
import { SettingsPopover } from './SettingsPopover';

const meta = {
  component: SettingsPopover,
  decorators: [
    (Story) => (
      <div className="settings-shell">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SettingsPopover>;
export default meta;
type Story = StoryObj;
export const AtBottomEdge: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLButtonElement>(null);
    return (
      <div className="flex h-[500px] items-end justify-end p-4">
        <button
          ref={ref}
          onClick={() => setOpen(!open)}
          className="settings-button"
        >
          Actions
        </button>
        <SettingsPopover
          open={open}
          anchorRef={ref}
          onClose={() => setOpen(false)}
          label="Profile actions"
        >
          {['Clone', 'Rename', 'Delete'].map((action) => (
            <button key={action} className="settings-button justify-start">
              {action}
            </button>
          ))}
        </SettingsPopover>
      </div>
    );
  },
};
