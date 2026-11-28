import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import type { DashboardBridge } from '@irdashies/types';
import { DamageSettings } from './DamageSettings';

const bridge: DashboardBridge = mockDashboardBridge;

const meta: Meta<typeof DamageSettings> = {
  component: DamageSettings,
  title: 'components/Settings/DamageSettings',
};

export default meta;

type Story = StoryObj<typeof DamageSettings>;

const onTab = (tab: string): Story['decorators'] => [
  (Story) => {
    localStorage.setItem('damageTab', tab);
    return (
      <DashboardProvider bridge={bridge}>
        <div style={{ height: '100vh', width: '1040px', overflowY: 'auto' }}>
          <Story />
        </div>
      </DashboardProvider>
    );
  },
];

export const Display: Story = { decorators: onTab('display') };
export const Visibility: Story = { decorators: onTab('visibility') };
