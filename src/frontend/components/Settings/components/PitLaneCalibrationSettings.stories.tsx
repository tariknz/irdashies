import type { Meta, StoryObj } from '@storybook/react-vite';
import type { PitLaneBridge } from '@irdashies/types';
import { PitLaneCalibrationSettings } from './PitLaneCalibrationSettings';

const mockBridge = (connected: boolean, learned: boolean): PitLaneBridge => {
  let hasCalibration = learned;
  let learningPaused = false;
  return {
    getPitLaneData: async (trackId) => ({
      trackId,
      sourceId: 'test-source',
      revision: 0,
      data: null,
    }),
    updatePitLaneData: async () => true,
    getCurrentTrackPitLaneInfo: async () =>
      connected
        ? {
            trackId: '47',
            trackName: 'WeatherTech Raceway Laguna Seca',
            hasCalibration,
            learningPaused,
          }
        : null,
    resetPitLaneData: async () => {
      hasCalibration = false;
    },
    openPitLaneDataFile: async () => {
      learningPaused = true;
    },
    reloadPitLaneDataFile: async () => {
      learningPaused = false;
    },
  };
};

const meta = {
  title: 'components/Settings/PitLaneCalibrationSettings',
  component: PitLaneCalibrationSettings,
  decorators: [
    (Story) => (
      <div className="w-[740px] bg-slate-900 p-6 text-white">
        <Story />
      </div>
    ),
  ],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof PitLaneCalibrationSettings>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Learned: Story = { args: { bridge: mockBridge(true, true) } };
export const WaitingForCalibration: Story = {
  args: { bridge: mockBridge(true, false) },
};
export const Disconnected: Story = {
  args: { bridge: mockBridge(false, false) },
};
