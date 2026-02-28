import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingSliderRow } from './SettingSliderRow';

const meta: Meta<typeof SettingSliderRow> = {
  component: SettingSliderRow,
  title: 'components/SettingSliderRow',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(50);
    return (
      <SettingSliderRow
        title="Opacity"
        description="Adjust the transparency level"
        value={value}
        min={0}
        max={100}
        step={1}
        onChange={setValue}
      />
    );
  },
};

export const WithUnits: Story = {
  render: () => {
    const [value, setValue] = useState(1.5);
    return (
      <SettingSliderRow
        title="Font Scale"
        description="Adjust the font size multiplier"
        units="px"
        value={value}
        min={1}
        max={20}
        step={1}
        onChange={setValue}
        showValue={true}
      />
    );
  },
};

export const NoDescription: Story = {
  render: () => {
    const [value, setValue] = useState(50);
    return (
      <SettingSliderRow
        title="Volume"
        value={value}
        min={0}
        max={100}
        onChange={setValue}
      />
    );
  },
};

export const PercentageWithDecimals: Story = {
  render: () => {
    const [value, setValue] = useState(80);
    return (
      <SettingSliderRow
        title="Glow Intensity"
        description="Set the glow effect intensity"
        units="%"
        value={value}
        min={0}
        max={100}
        step={0.1}
        onChange={setValue}
      />
    );
  },
};