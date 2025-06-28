import { Meta, StoryObj } from '@storybook/react-vite';
import { TrackCanvas, TrackDriver } from './TrackCanvas';
import { useEffect, useState } from 'react';
import tracks from './tracks/tracks.json';

export default {
  component: TrackCanvas,
  argTypes: {
    trackId: {
      control: { type: 'number' },
    },
  },
} as Meta;

type Story = StoryObj<typeof TrackCanvas>;

const sampleData = [
  {
    driver: {
      CarIdx: 2,
      CarNumber: '20',
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
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.7775947451591492,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 15,
      CarNumber: '10',
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.9761711955070496,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 16,
      CarNumber: '13',
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.9293166399002075,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 18,
      CarNumber: '17',
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.02848833240568638,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 19,
      CarNumber: '18',
      CarClassColor: 16734344,
      CarClassEstLapTime: 126.9374,
    },
    progress: 0.05448886379599571,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 20,
      CarNumber: '19',
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
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.9219207167625427,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 31,
      CarNumber: '6',
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.6734675765037537,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 32,
      CarNumber: '7',
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.525010883808136,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 33,
      CarNumber: '9',
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
      CarClassColor: 11430911,
      CarClassEstLapTime: 126.2284,
    },
    progress: 0.8447133302688599,
    isPlayer: false,
  },
] as TrackDriver[];

export const Primary: Story = {
  args: {
    trackId: 1,
    drivers: sampleData,
  },
};

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

    return <TrackCanvas trackId={args.trackId} drivers={drivers} />;
  },
  args: {
    trackId: 1,
    drivers: sampleData,
  },
};

// All available track IDs from tracks.json
const allTrackIds = Object.keys(tracks)
  .map(Number)
  .filter(trackId => !isNaN(trackId) && tracks[trackId.toString() as keyof typeof tracks])
  .sort((a, b) => a - b);

export const AllTracksGrid: Story = {
  render: () => {
    const trackSize = 150;

    return (
      <div className="p-4 bg-gray-900 min-h-screen font-sans">
        <h1 className="text-white text-center mb-6 text-2xl">
          All Available Tracks ({allTrackIds.length} total)
        </h1>
        <div 
          className="grid gap-4 justify-center mx-auto"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          {allTrackIds.map((trackId) => (
            <div 
              key={trackId} 
              className="border border-gray-600 rounded-lg overflow-hidden bg-gray-800 relative aspect-square"
              style={{ maxWidth: trackSize, maxHeight: trackSize }}
            >
              <div className="absolute top-1 left-1 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-xs z-10">
                Track {trackId}
              </div>
              <div className="w-full h-full">
                <TrackCanvas 
                  trackId={trackId} 
                  drivers={sampleData} 
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};
