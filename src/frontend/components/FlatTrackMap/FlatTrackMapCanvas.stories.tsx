import { Meta, StoryObj } from '@storybook/react-vite';
import { FlatTrackMapCanvas } from './FlatTrackMapCanvas';
import { TrackDriver, TrackDrawing } from '../TrackMap/TrackCanvas';
import { useEffect, useState } from 'react';
import tracks from '../TrackMap/tracks/tracks.json';

export default {
  component: FlatTrackMapCanvas,
  title: 'widgets/FlatTrackMap/components/FlatTrackMapCanvas',
  args: {
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
  argTypes: {
    showCarNumbers: {
      control: { type: 'boolean' },
    },
    driverCircleSize: {
      control: { type: 'range', min: 10, max: 80, step: 1 },
    },
    playerCircleSize: {
      control: { type: 'range', min: 10, max: 100, step: 1 },
    },
    trackLineWidth: {
      control: { type: 'range', min: 5, max: 40, step: 1 },
    },
    trackOutlineWidth: {
      control: { type: 'range', min: 10, max: 80, step: 1 },
    },
    invertTrackColors: {
      control: { type: 'boolean' },
    },
    highlightColor: {
      control: { type: 'number' },
      description: 'Highlight color for player circle (RGB number). Leave undefined to use amber (16096779).',
    },
  },
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '200px' }}>
        <Story />
      </div>
    ),
  ],
} as Meta;

type Story = StoryObj<typeof FlatTrackMapCanvas>;

const sampleData = [
  {
    driver: {
      CarIdx: 2,
      CarNumber: '20',
      CarClassID: 1,
      CarClassColor: 16767577,
      CarClassEstLapTime: 113.6302,
    },
    progress: 0.841148853302002,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 9,
      CarNumber: '38',
      CarClassID: 1,
      CarClassColor: 16767577,
      CarClassEstLapTime: 113.6302,
    },
    progress: 0.936923086643219,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 10,
      CarNumber: '39',
      CarClassID: 1,
      CarClassColor: 16767577,
      CarClassEstLapTime: 113.6302,
    },
    progress: 0.06046311929821968,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 13,
      CarNumber: '5',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.7775947451591492,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 16,
      CarNumber: '7',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.8862644433975220,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 17,
      CarNumber: '10',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.9399058818817139,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 19,
      CarNumber: '12',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.9098973274230957,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 20,
      CarNumber: '18',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.7962191104888916,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 21,
      CarNumber: '19',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.5834031105041504,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 22,
      CarNumber: '22',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.48615148663520813,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 23,
      CarNumber: '23',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.8612086772918701,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 24,
      CarNumber: '24',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.9262315034866333,
    isPlayer: true,
  },
  {
    driver: {
      CarIdx: 25,
      CarNumber: '25',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.8546850681304932,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 26,
      CarNumber: '31',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.7217929363250732,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 27,
      CarNumber: '32',
      CarClassID: 2,
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.8576954007148743,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 28,
      CarNumber: '1',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.37332478165626526,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 29,
      CarNumber: '2',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.6421698927879333,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 30,
      CarNumber: '3',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.5595431923866272,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 33,
      CarNumber: '9',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.6666178107261658,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 35,
      CarNumber: '12',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.675060510635376,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 36,
      CarNumber: '16',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.8526926636695862,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 37,
      CarNumber: '27',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.7811623811721802,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 39,
      CarNumber: '29',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.7012394070625305,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 40,
      CarNumber: '30',
      CarClassID: 3,
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.8447133302688599,
    isPlayer: false,
  },
] as TrackDriver[];

const trackDrawing = tracks['1' as keyof typeof tracks] as TrackDrawing;

export const Primary: Story = {
  args: {
    trackDrawing,
    drivers: sampleData,
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
};

export const InvertedTrackColors: Story = {
  args: {
    trackDrawing,
    drivers: sampleData,
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: true,
    highlightColor: undefined,
  },
};

export const SingleClass: Story = {
  args: {
    trackDrawing,
    drivers: sampleData.filter(({ driver }) => driver.CarClassID === 2),
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
};

export const WithoutCarNumbers: Story = {
  args: {
    trackDrawing,
    drivers: sampleData,
    showCarNumbers: false,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
};

export const SingleDriver: Story = {
  argTypes: {
    progress: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
      description: 'Driver progress around the track (0-1)',
    },
    carNumber: {
      control: { type: 'text' },
      description: 'Driver car number',
    },
    isPlayer: {
      control: { type: 'boolean' },
    },
    carClassColor: {
      control: { type: 'number' },
      description: 'Driver car class color',
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  render: (args: any) => {
    const drivers = [{
      driver: {
        CarIdx: 39,
        CarNumber: args.carNumber || '29',
        CarClassID: 3,
        CarClassColor: args.carClassColor || 11430911,
        CarClassEstLapTime: 126.2284,
      },
      progress: args.progress || 0,
      isPlayer: args.isPlayer || false,
    }] as TrackDriver[];

    return (
      <FlatTrackMapCanvas 
        trackDrawing={trackDrawing}
        drivers={drivers} 
        showCarNumbers={args.showCarNumbers ?? true}
        driverCircleSize={args.driverCircleSize ?? 40}
        playerCircleSize={args.playerCircleSize ?? 40}
        trackLineWidth={args.trackLineWidth ?? 20}
        trackOutlineWidth={args.trackOutlineWidth ?? 40}
        invertTrackColors={args.invertTrackColors ?? false}
        highlightColor={args.highlightColor}
      />
    );
  },
  args: {
    progress: 0,
    carNumber: '29',
    isPlayer: true,
    carClassColor: 11430911,
  },
} as Story;

export const CirclingAround: Story = {
  render: (args) => {
    const [drivers, setDrivers] = useState(args.drivers);
    useEffect(() => {
      const interval = setInterval(() => {
        const newDrivers = drivers.map((driver) => ({
          ...driver,
          progress: (driver.progress + 0.005) % 1,
        }));

        setDrivers(newDrivers);
      }, 50);

      return () => clearInterval(interval);
    });

    return (
      <FlatTrackMapCanvas 
        trackDrawing={trackDrawing}
        drivers={drivers} 
        showCarNumbers={args.showCarNumbers ?? true}
        driverCircleSize={args.driverCircleSize ?? 40}
        playerCircleSize={args.playerCircleSize ?? 40}
        trackLineWidth={args.trackLineWidth ?? 20}
        trackOutlineWidth={args.trackOutlineWidth ?? 40}
        invertTrackColors={args.invertTrackColors ?? false}
        highlightColor={args.highlightColor}
      />
    );
  },
  args: {
    drivers: sampleData,
  },
};

export const WideView: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '150px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    trackDrawing,
    drivers: sampleData,
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
};

export const TallView: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '300px' }}>
        <Story />
      </div>
    ),
  ],
  args: {
    trackDrawing,
    drivers: sampleData,
    showCarNumbers: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    invertTrackColors: false,
    highlightColor: undefined,
  },
};

export const ResponsiveAnimation: Story = {
  decorators: [
    (Story) => (
      <div style={{ width: '100%', height: '100vh', display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px' }}>
        <div style={{ flex: 1, border: '2px solid #666' }}>
          <Story />
        </div>
        <div style={{ flex: 1, border: '2px solid #666' }}>
          <Story />
        </div>
        <div style={{ flex: 2, border: '2px solid #666' }}>
          <Story />
        </div>
      </div>
    ),
  ],
  render: (args) => {
    const [drivers, setDrivers] = useState(args.drivers);
    useEffect(() => {
      const interval = setInterval(() => {
        const newDrivers = drivers.map((driver) => ({
          ...driver,
          progress: (driver.progress + 0.005) % 1,
        }));

        setDrivers(newDrivers);
      }, 50);

      return () => clearInterval(interval);
    });

    return (
      <FlatTrackMapCanvas 
        trackDrawing={trackDrawing}
        drivers={drivers} 
        showCarNumbers={args.showCarNumbers ?? true}
        driverCircleSize={args.driverCircleSize ?? 40}
        playerCircleSize={args.playerCircleSize ?? 40}
        trackLineWidth={args.trackLineWidth ?? 20}
        trackOutlineWidth={args.trackOutlineWidth ?? 40}
        invertTrackColors={args.invertTrackColors ?? false}
        highlightColor={args.highlightColor}
      />
    );
  },
  args: {
    drivers: sampleData,
  },
};
