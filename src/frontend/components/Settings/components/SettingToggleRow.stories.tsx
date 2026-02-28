import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingToggleRow } from './SettingToggleRow';

const meta: Meta<typeof SettingToggleRow> = {
  component: SettingToggleRow,
  title: 'components/SettingToggleRow',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false);
    return (
      <SettingToggleRow
        title="Enable Feature"
        description="Toggle this feature on or off"
        enabled={enabled}
        onToggle={setEnabled}
      />
    );
  },
};

export const NoDescription: Story = {
  render: () => {
    const [enabled, setEnabled] = useState(false);
    return (
      <SettingToggleRow
        title="Enable Feature"
        enabled={enabled}
        onToggle={setEnabled}
      />
    );
  },
};