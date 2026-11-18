import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { SettingsTabBar } from './SettingsTabBar';
import { TabButton } from './TabButton';

const meta = {
  component: SettingsTabBar,
  title: 'components/SettingsTabBar',
} satisfies Meta<typeof SettingsTabBar>;

export default meta;
type Story = StoryObj<typeof SettingsTabBar>;

const Tabs = ({ tabs }: { tabs: string[] }) => {
  const [activeTab, setActiveTab] = useState(tabs[0]);

  return (
    <SettingsTabBar>
      {tabs.map((tab) => (
        <TabButton
          key={tab}
          id={tab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        >
          {tab}
        </TabButton>
      ))}
    </SettingsTabBar>
  );
};

const ROWS = Array.from({ length: 30 }, (_, index) => `Setting ${index + 1}`);

export const StickyWhileScrolling: Story = {
  render: () => (
    <div
      ref={(element) => {
        if (element) element.scrollTop = 400;
      }}
      className="h-80 w-[480px] overflow-y-auto bg-slate-900 px-4 pb-4 text-slate-200"
    >
      <Tabs tabs={['Layout', 'Options', 'Visibility']} />
      <div className="space-y-2 pt-3">
        {ROWS.map((row) => (
          <div key={row} className="rounded-md bg-slate-800 px-3 py-2 text-sm">
            {row}
          </div>
        ))}
      </div>
    </div>
  ),
};

export const Wrapped: Story = {
  render: () => (
    <div className="w-72 bg-slate-900 p-4">
      <Tabs
        tabs={[
          'Layout',
          'Options',
          'Visibility',
          'Columns',
          'Header',
          'Footer',
          'Colours',
        ]}
      />
    </div>
  ),
};
