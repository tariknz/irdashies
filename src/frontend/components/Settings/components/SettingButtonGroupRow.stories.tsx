import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingButtonGroupRow } from './SettingButtonGroupRow';

const meta: Meta<typeof SettingButtonGroupRow> = {
  component: SettingButtonGroupRow,
  title: 'components/SettingButtonGroupRow',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState<'left' | 'center' | 'right'>('center');
    return (
      <SettingButtonGroupRow
        title="Alignment"
        value={value}
        options={[
          { label: 'Left', value: 'left' },
          { label: 'Center', value: 'center' },
          { label: 'Right', value: 'right' },
        ]}
        onChange={setValue}
      />
    );
  },
};

export const TwoOptions: Story = {
  render: () => {
    const [value, setValue] = useState<'on' | 'off'>('off');
    return (
      <SettingButtonGroupRow
        title="Mode"
        value={value}
        options={[
          { label: 'On', value: 'on' },
          { label: 'Off', value: 'off' },
        ]}
        onChange={setValue}
      />
    );
  },
};

export const ManyOptions: Story = {
  render: () => {
    const [value, setValue] = useState<'xs' | 'sm' | 'md' | 'lg' | 'xl'>('md');
    return (
      <SettingButtonGroupRow
        title="Size"
        value={value}
        options={[
          { label: 'XS', value: 'xs' },
          { label: 'SM', value: 'sm' },
          { label: 'MD', value: 'md' },
          { label: 'LG', value: 'lg' },
          { label: 'XL', value: 'xl' },
        ]}
        onChange={setValue}
      />
    );
  },
};