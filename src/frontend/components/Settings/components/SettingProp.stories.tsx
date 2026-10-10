import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SettingProp, SettingProps } from './SettingProp';

const meta: Meta<typeof SettingProp> = {
  component: SettingProp,
  title: 'components/SettingProp',
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Wind's properties, each row built from its manifest description. */
export const WindProperties: Story = {
  render: () => {
    const [config, setConfig] = useState(getWidgetDefaultConfig('wind'));
    return (
      <SettingProps
        widget="wind"
        config={config}
        onChange={(update) => setConfig((c) => ({ ...c, ...update }))}
      >
        <div className="space-y-4">
          <SettingProp path="background.opacity" />
          <SettingProp path="units" />
          <SettingProp path="showOnlyWhenOnTrack" />
        </div>
      </SettingProps>
    );
  },
};
