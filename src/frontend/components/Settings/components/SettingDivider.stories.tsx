import { Meta, StoryObj } from '@storybook/react-vite';
import { SettingDivider } from './SettingDivider';
import { SettingToggleRow } from './SettingToggleRow';
import { useState } from 'react';

const meta: Meta<typeof SettingDivider> = {
  component: SettingDivider,
  title: 'components/SettingDivider',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [toggle1, setToggle1] = useState(false);
    const [toggle2, setToggle2] = useState(true);
    return (
      <div className="space-y-4">
        <SettingToggleRow
          title="Option 1"
          description="First option"
          enabled={toggle1}
          onToggle={setToggle1}
        />
        <SettingDivider />
        <SettingToggleRow
          title="Option 2"
          description="Second option"
          enabled={toggle2}
          onToggle={setToggle2}
        />
      </div>
    );
  },
};