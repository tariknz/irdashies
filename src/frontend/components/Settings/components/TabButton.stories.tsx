import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TwitchLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { TabButton } from './TabButton';
import type { SettingsTabType } from '@irdashies/types';

const meta = {
  component: TabButton,
  title: 'components/TabButton',
} satisfies Meta<typeof TabButton>;

export default meta;
type Story = StoryObj<typeof TabButton>;

export const Interactive: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<SettingsTabType>('layout');

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

export const WithIcons: Story = {
  render: () => {
    const [activeTab, setActiveTab] = useState<SettingsTabType>('youtube');

    return (
      <div className="bg-slate-800 p-6">
        <div className="flex border-b border-slate-700/50">
          <TabButton
            id="display"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          >
            Display
          </TabButton>
          <TabButton
            id="twitch"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            icon={<TwitchLogoIcon size={18} weight="fill" color="#a970ff" />}
          >
            Twitch
          </TabButton>
          <TabButton
            id="youtube"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            icon={<YoutubeLogoIcon size={18} weight="fill" color="#ff0000" />}
          >
            YouTube
          </TabButton>
        </div>
      </div>
    );
  },
};
