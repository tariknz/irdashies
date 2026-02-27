import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TabButton } from './TabButton';
import type { SettingsTabType } from '../types';

const meta = {
  component: TabButton,
  title: 'components/TabButton',
} satisfies Meta<typeof TabButton>;

export default meta;
type Story = StoryObj<typeof TabButton>;

export const Interactive: Story = {
  render: () => {
    const [activeTab, setActiveTab] =
      useState<SettingsTabType>('layout');

    return (
      <div className="bg-slate-900 p-6 flex gap-4">
        <TabButton
          id="layout"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        >
          Layout
        </TabButton>

        <TabButton
          id="options"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        >
          Options
        </TabButton>

        <TabButton
          id="visibility"
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        >
          Visibility
        </TabButton>
      </div>
    );
  },
};