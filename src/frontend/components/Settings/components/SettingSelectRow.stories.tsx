import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingSelectRow } from './SettingSelectRow';

const meta: Meta<typeof SettingSelectRow> = {
  component: SettingSelectRow,
  title: 'components/SettingSelectRow',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<string>('medium');
    return (
      <SettingSelectRow
        title="Font Size"
        description="Select the preferred font size"
        value={value}
        options={[
          { label: 'Small', value: 'small' },
          { label: 'Medium', value: 'medium' },
          { label: 'Large', value: 'large' },
          { label: 'Extra Large', value: 'xlarge' },
        ]}
        onChange={setValue}
      />
    );
  },
};

export const NoDescription: Story = {
  render: () => {
    const [value, setValue] = useState<'day' | 'night' | 'auto'>('auto');
    return (
      <SettingSelectRow
        title="Theme"
        value={value}
        options={[
          { label: 'Day', value: 'day' },
          { label: 'Night', value: 'night' },
          { label: 'Auto', value: 'auto' },
        ]}
        onChange={setValue}
      />
    );
  },
};