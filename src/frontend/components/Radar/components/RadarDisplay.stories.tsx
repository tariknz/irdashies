import type { Meta, StoryObj } from '@storybook/react-vite';
import { RadarDisplay } from './RadarDisplay';
import type { RadarBlip } from '../radarBlips';

/**
 * The disc drawn from hand-built blips. The widget stories drive the same
 * component from a recording, so the rim signals are only reachable here.
 */

const blip = (
  carIdx: number,
  alongM: number,
  lateralM: number,
  carNumber: string,
  extra: Partial<RadarBlip> = {}
): RadarBlip => ({
  carIdx,
  alongM,
  lateralM,
  relYaw: 0,
  gapM: Math.abs(alongM),
  side: null,
  rimSignal: null,
  carNumber,
  isPaceCar: false,
  ...extra,
});

const AHEAD = blip(1, 11, 0.2, '24');
const CLOSING = blip(2, -4, 2.4, '7');
const PACE = blip(6, 5.5, 0.4, '0', { isPaceCar: true });

const meta = {
  component: RadarDisplay,
  title: 'widgets/Radar/Disc',
  decorators: [
    (Story: React.ComponentType) => (
      <div className="bg-slate-800 p-5">
        <div className="h-[300px] w-[300px]">
          <Story />
        </div>
      </div>
    ),
  ],
  args: {
    blips: [AHEAD, CLOSING],
    radarRange: 15,
    vehicleWidth: 1.9,
    vehicleLength: 4.5,
    showCarNumbers: true,
    colorRival: '#cbd5e1',
    colorPlayer: '#2fd16a',
    viewMode: 'top',
    rearCameraTilt: 45,
    bgOpacity: 30,
    sideIndicatorColor: '#ef4444',
    sideIndicatorStyle: 'double-arc',
    sideIndicatorEnabled: true,
    sideIndicatorOpacity: 90,
    // Any positive length works: the disc places blips by metre offset, and
    // without it the motion targets are NaN and no car is drawn at all.
    trackLengthM: 5000,
    showFollowingMap: false,
    // The road passes through (0, 0): the player's own path point is the
    // origin of this frame, and the player is drawn at the centre.
    followingMapPath: new Float64Array([
      -45, -5, -30, -3, -15, -1, 0, 0, 15, 1.5, 30, 4, 45, 8,
    ]),
    followingMapPointCount: 7,
    followingMapWindowM: 90,
    followingMapBorderColor: '#334155',
    followingMapBorderOpacity: 95,
    followingMapFillColor: '#64748b',
    followingMapFillOpacity: 55,
  },
  argTypes: {
    radarRange: { control: { type: 'range', min: 10, max: 25, step: 1 } },
    bgOpacity: { control: { type: 'range', min: 0, max: 100, step: 5 } },
    followingMapBorderOpacity: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
    },
    followingMapFillOpacity: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
    },
    followingMapBorderColor: { control: { type: 'color' } },
    followingMapFillColor: { control: { type: 'color' } },
    showCarNumbers: { control: { type: 'boolean' } },
    colorRival: { control: { type: 'color' } },
    colorPlayer: { control: { type: 'color' } },
  },
} satisfies Meta<typeof RadarDisplay>;

export default meta;

type Story = StoryObj<typeof RadarDisplay>;

export const Disc: Story = {};

export const RearCamera: Story = {
  args: { viewMode: 'rear', rearCameraTilt: 45 },
};

export const AlongsideLeft: Story = {
  name: 'Alongside, left',
  args: { blips: [AHEAD, blip(7, 0.3, -2, '51', { rimSignal: 'left' })] },
};

export const AlongsideRight: Story = {
  name: 'Alongside, right',
  args: { blips: [AHEAD, blip(7, 0.3, 2, '51', { rimSignal: 'right' })] },
};

export const AlongsideBoth: Story = {
  name: 'Alongside, both arcs only',
  args: {
    // A both signal deliberately omits the level car: only the two rim arcs
    // distinguish this unknown-side overlap from the player underneath it.
    blips: [AHEAD, blip(7, 0.3, 0, '31', { side: null, rimSignal: 'both' })],
  },
};

export const WithoutCarNumbers: Story = {
  name: 'Without car numbers',
  args: { showCarNumbers: false },
};

export const NoCarsInRange: Story = {
  name: 'No cars in range',
  args: { blips: [] },
};

export const PaceCar: Story = {
  name: 'Pace car',
  args: { blips: [AHEAD, PACE] },
};

export const FollowingMap: Story = {
  name: 'Following track map',
  args: {
    showFollowingMap: true,
    followingMapBorderColor: '#fbbf24',
    followingMapBorderOpacity: 90,
    followingMapFillColor: '#78350f',
    followingMapFillOpacity: 70,
    // Cars on the road rather than beside it. The player's frame puts the
    // player at lateral 0 on the centreline, so the road passes through
    // (0, 0) and the cars sit on the curve that leaves it.
    blips: [
      blip(1, 12, 1.1, '24'),
      blip(2, -5, -0.4, '7'),
      blip(3, 0.3, 0, '51'),
    ],
  },
};
