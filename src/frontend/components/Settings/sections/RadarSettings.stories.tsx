import { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import type { DashboardBridge } from '@irdashies/types';
import { RadarSettings } from './RadarSettings';

const bridge: DashboardBridge = {
  ...mockDashboardBridge,
  getRadarPoleSides: () =>
    Promise.resolve({
      'Okayama International Circuit': { pace: 'right' },
      'Sebring International Raceway': { grid: 'left', pace: 'left' },
    }),
  setRadarPoleSide: () => Promise.resolve(),
};

const meta: Meta<typeof RadarSettings> = {
  component: RadarSettings,
  title: 'components/Settings/RadarSettings',
};

export default meta;

type Story = StoryObj<typeof RadarSettings>;

/** Opens the menu at one level, as the user last left it. */
const atLevel = (level: number): Story['decorators'] => [
  (Story) => {
    localStorage.setItem('radarSettingsLevel', String(level));
    return (
      <DashboardProvider bridge={bridge}>
        <div style={{ height: '100vh', width: '640px', overflowY: 'auto' }}>
          <Story />
        </div>
      </DashboardProvider>
    );
  },
];

export const Basic: Story = { decorators: atLevel(0) };
export const Advanced: Story = { decorators: atLevel(1) };
export const Dev: Story = { decorators: atLevel(2) };
