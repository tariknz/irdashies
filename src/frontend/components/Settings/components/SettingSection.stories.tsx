import { Meta, StoryObj } from '@storybook/react-vite';
import { SettingsSection } from './SettingSection';
import { SettingToggleRow } from './SettingToggleRow';
import { SettingNumberRow } from './SettingNumberRow';
import { useState } from 'react';

const meta: Meta<typeof SettingsSection> = {
  component: SettingsSection,
  title: 'components/SettingSection',
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [toggle, setToggle] = useState(false);
    const [number, setNumber] = useState(50);
    return (
      <SettingsSection title="Display">
        <SettingToggleRow
          title="Enable"
          description="Enable this feature"
          enabled={toggle}
          onToggle={setToggle}
        />
        <SettingNumberRow
          title="Intensity"
          description="Set the intensity level"
          value={number}
          min={0}
          max={100}
          onChange={setNumber}
        />
      </SettingsSection>
    );
  },
};

export const NoTitle: Story = {
  render: () => {
    const [toggle, setToggle] = useState(false);
    return (
      <SettingsSection>
        <SettingToggleRow
          title="Option 1"
          enabled={toggle}
          onToggle={setToggle}
        />
      </SettingsSection>
    );
  },
};

export const SubSections: Story = {
  render: () => {
    const [toggle, setToggle] = useState(true);
    return (
      <SettingsSection title="Advanced">
        <SettingToggleRow
          title="Debug Mode"
          description="Enable developer debugging features"
          enabled={toggle}
          onToggle={setToggle}
        />
        <SettingsSection>
            <SettingToggleRow
            title="Sub Debug Mode"
            description="Sub menu for developer debugging features"
            enabled={toggle}
            onToggle={setToggle}
            />
        </SettingsSection>
      </SettingsSection>
    );
  },
};