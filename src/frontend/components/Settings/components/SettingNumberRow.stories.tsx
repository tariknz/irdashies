import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingNumberRow } from './SettingNumberRow';

const meta: Meta<typeof SettingNumberRow> = {
  component: SettingNumberRow,
  title: 'components/SettingNumberRow',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(50);
    return (
      <SettingNumberRow
        title="Value"
        description="Enter a number between 0 and 100"
        value={value}
        min={0}
        max={100}
        onChange={setValue}
      />
    );
  },
};

export const WithDecimals: Story = {
  render: () => {
    const [value, setValue] = useState(0.5);
    return (
      <SettingNumberRow
        title="Blink Period (s)"
        description="Set how many seconds between on/off when animation is enabled. Min 0.1s, Max 3s."
        value={value}
        min={0.1}
        max={3}
        step={0.1}
        onChange={setValue}
      />
    );
  },
};

export const NoDescription: Story = {
  render: () => {
    const [value, setValue] = useState(10);
    return (
      <SettingNumberRow
        title="Count"
        value={value}
        min={1}
        max={100}
        onChange={setValue}
      />
    );
  },
};

export const LargeRange: Story = {
  render: () => {
    const [value, setValue] = useState(5000);
    return (
      <SettingNumberRow
        title="Timeout (ms)"
        description="Maximum time in milliseconds"
        value={value}
        min={100}
        max={60000}
        step={100}
        onChange={setValue}
      />
    );
  },
};