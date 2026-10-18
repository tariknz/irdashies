import type { Meta, StoryObj } from '@storybook/react-vite';
import { DashboardProvider } from '@irdashies/context';
import { mockDashboardBridge } from '@irdashies/storybook';
import type { PitLaneBridge } from '@irdashies/types';
import { PitlaneHelperSettings } from './PitlaneHelperSettings';

let learningPaused = false;
const pitLaneBridge: PitLaneBridge = {
  getPitLaneData: async (trackId) => ({
    trackId,
    sourceId: 'storybook',
    revision: 0,
    data: null,
  }),
  updatePitLaneData: async () => true,
  getCurrentTrackPitLaneInfo: async () => ({
    trackId: '47',
    trackName: 'WeatherTech Raceway Laguna Seca',
    hasCalibration: true,
    learningPaused,
  }),
  resetPitLaneData: async () => undefined,
  openPitLaneDataFile: async () => {
    learningPaused = true;
  },
  reloadPitLaneDataFile: async () => {
    learningPaused = false;
  },
};

const meta = {
  title: 'components/Settings/PitlaneHelperSettings',
  component: PitlaneHelperSettings,
  decorators: [
    (Story) => {
      window.pitLaneBridge = pitLaneBridge;
      return (
        <DashboardProvider bridge={mockDashboardBridge}>
          <div className="h-[700px] w-[880px] bg-slate-900 p-6 text-white">
            <Story />
          </div>
        </DashboardProvider>
      );
    },
  ],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PitlaneHelperSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Options: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem('pitLaneTab', 'options');
      return <Story />;
    },
  ],
};
export const Calibration: Story = {
  decorators: [
    (Story) => {
      localStorage.setItem('pitLaneTab', 'calibration');
      return <Story />;
    },
  ],
};
