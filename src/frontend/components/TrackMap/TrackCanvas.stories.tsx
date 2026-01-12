import { Meta, StoryObj } from '@storybook/react-vite';
import { TrackCanvas, TrackDriver } from './TrackCanvas';
import { useEffect, useState } from 'react';
import tracks from './tracks/tracks.json';
import { BROKEN_TRACKS } from './tracks/brokenTracks';

export default {
  component: TrackCanvas,
  title: 'widgets/TrackMap/components/TrackCanvas',
  args: {
    enableTurnNames: false,
    showCarNumbers: true,
    invertTrackColors: false,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    highlightColor: undefined,
    debug: true,
  },
  argTypes: {
    trackId: {
      control: { type: 'number' },
    },
    enableTurnNames: {
      control: { type: 'boolean' },
    },
    showCarNumbers: {
      control: { type: 'boolean' },
    },
    invertTrackColors: {
      control: { type: 'boolean' },
    },
    driverCircleSize: {
      control: { type: 'range', min: 10, max: 100, step: 1 },
    },
    playerCircleSize: {
      control: { type: 'range', min: 10, max: 100, step: 1 },
    },
    trackLineWidth: {
      control: { type: 'range', min: 5, max: 100, step: 1 },
    },
    trackOutlineWidth: {
      control: { type: 'range', min: 5, max: 150, step: 1 },
    },
    highlightColor: {
      control: { type: 'number' },
      description: 'Highlight color for player circle (RGB number). Leave undefined to use amber (16096779).',
    },
    debug: {
      control: { type: 'boolean' },
    },
  },
} as Meta;

type Story = StoryObj<typeof TrackCanvas>;

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
      CarIdx: 15,
      CarNumber: '10',
      CarClassID: 2,
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
      CarClassID: 2,
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
      CarClassID: 2,
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
      CarClassID: 2,
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
    progress: 0.9219207167625427,
    isPlayer: false,
  },
  {
    driver: {
      CarIdx: 31,
      CarNumber: '6',
      CarClassID: 3,
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
      CarClassID: 3,
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

export const Primary: Story = {
  args: {
    trackId: 1,
    drivers: sampleData,
    enableTurnNames: true,
    showCarNumbers: true,
    invertTrackColors: false,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    highlightColor: undefined,
  },
};

export const InvertedTrackColors: Story = {
  args: {
    trackId: 1,
    drivers: sampleData,
    enableTurnNames: true,
    showCarNumbers: true,
    invertTrackColors: true,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
    highlightColor: undefined,
  },
};

export const SingleClass: Story = {
  args: {
    trackId: 1,
    drivers: sampleData.filter(({ driver }) => driver.CarClassID === 2),
    enableTurnNames: true,
    showCarNumbers: true,
    invertTrackColors: false,
    driverCircleSize: 40,
    playerCircleSize: 40,
    trackLineWidth: 20,
    trackOutlineWidth: 40,
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
      <TrackCanvas 
        trackId={args.trackId} 
        drivers={drivers} 
        enableTurnNames={args.enableTurnNames}
        showCarNumbers={args.showCarNumbers ?? true}
        invertTrackColors={args.invertTrackColors ?? false}
        driverCircleSize={args.driverCircleSize ?? 40}
        playerCircleSize={args.playerCircleSize ?? 40}
        trackLineWidth={args.trackLineWidth ?? 20}
        trackOutlineWidth={args.trackOutlineWidth ?? 40}
        highlightColor={args.highlightColor}
      />
    );
  },
  args: {
    trackId: 1,
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
      <TrackCanvas 
        trackId={args.trackId} 
        drivers={drivers} 
        enableTurnNames={args.enableTurnNames}
        showCarNumbers={args.showCarNumbers ?? true}
        invertTrackColors={args.invertTrackColors ?? false}
        driverCircleSize={args.driverCircleSize ?? 40}
        playerCircleSize={args.playerCircleSize ?? 40}
        trackLineWidth={args.trackLineWidth ?? 20}
        trackOutlineWidth={args.trackOutlineWidth ?? 40}
        highlightColor={args.highlightColor}
      />
    );
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
  render: (args) => {
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
                  enableTurnNames={args.enableTurnNames}
                  showCarNumbers={args.showCarNumbers ?? true}
                  invertTrackColors={args.invertTrackColors ?? false}
                  driverCircleSize={args.driverCircleSize ?? 40}
                  playerCircleSize={args.playerCircleSize ?? 40}
                  trackLineWidth={args.trackLineWidth ?? 20}
                  trackOutlineWidth={args.trackOutlineWidth ?? 40}
                  highlightColor={args.highlightColor}
                  debug={args.debug}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};

export const BrokenTracksGrid: Story = {
  render: (args) => {
    const trackSize = 200;

    return (
      <div className="p-4 bg-gray-900 min-h-screen font-sans">
        <h1 className="text-white text-center mb-6 text-2xl">
          Broken Tracks ({BROKEN_TRACKS.length} total)
        </h1>
        <p className="text-gray-400 text-center mb-6">
          These tracks are broken and will be hidden in production but available for debugging in development/storybook.
        </p>
        <div 
          className="grid gap-4 justify-center mx-auto"
          style={{
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            maxWidth: '100%',
            width: '100%'
          }}
        >
          {BROKEN_TRACKS.map((brokenTrack) => (
            <div 
              key={brokenTrack.id} 
              className="border border-red-600 rounded-lg overflow-hidden bg-gray-800 relative aspect-square"
              style={{ maxWidth: trackSize, maxHeight: trackSize }}
            >
              <div className="w-full h-full">
                <TrackCanvas 
                  trackId={brokenTrack.id} 
                  drivers={sampleData} 
                  enableTurnNames={args.enableTurnNames}
                  showCarNumbers={args.showCarNumbers ?? true}
                  invertTrackColors={args.invertTrackColors ?? false}
                  driverCircleSize={args.driverCircleSize ?? 40}
                  playerCircleSize={args.playerCircleSize ?? 40}
                  trackLineWidth={args.trackLineWidth ?? 20}
                  trackOutlineWidth={args.trackOutlineWidth ?? 40}
                  highlightColor={args.highlightColor}
                  debug={args.debug}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  },
};
