import { Meta, StoryObj } from '@storybook/react-vite';
import {
  FasterCarsFromBehind,
  FasterCarsFromBehindDisplay,
} from './FasterCarsFromBehind';
import { TelemetryDecorator } from '@irdashies/storybook';

// Mock the settings hook for stories
const mockSettings = {
  showOnlyWhenOnTrack: true,
  distanceThreshold: -1.5,
  numberDriversBehind: 3,
  alignDriverBoxes: 'Top' as const,
  closestDriverBox: 'Top' as const,
  showName: true,
  removeNumbersFromName: true,
  showDistance: true,
  showBadge: true,
  badgeFormat: 'license-color-rating-bw' as const,
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

export default {
  component: FasterCarsFromBehindDisplay,
  title: 'widgets/FasterCarsFromBehind',
  argTypes: {
    classColor: {
      options: [undefined, 0xffda59, 0x33ceff, 0xff5888, 0xae6bff, 0xffffff],
      control: { type: 'select' },
    },
    percent: {
      control: { type: 'range', min: 0, max: 100 },
    },
  },
  parameters: {
    mockData: [
      {
        url: '/mock-api/settings',
        method: 'GET',
        status: 200,
        response: mockSettings,
      },
    ],
  },
} as Meta<typeof FasterCarsFromBehindDisplay>;

type Story = StoryObj<typeof FasterCarsFromBehindDisplay>;

export const Primary: Story = {
  render: () => <FasterCarsFromBehind />,
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export const Display: Story = {
  args: {
    name: 'Tom Wilson2',
    license: 'A 4.2',
    rating: 1420,
    distance: -1.0,
    percent: 50,
    classColor: 0xffda59,
  },
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};

export const MultipleDrivers: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <FasterCarsFromBehindDisplay
        name="Tom Wilson2"
        license="A 4.2"
        rating={1420}
        distance={-1.0}
        percent={80}
        classColor={0xffda59} // Yellow/GT3
      />
      <FasterCarsFromBehindDisplay
        name="Jane Smith"
        license="B 3.8"
        rating={1250}
        distance={-2.5}
        percent={60}
        classColor={0x33ceff} // Blue/GT4
      />
      <FasterCarsFromBehindDisplay
        name="Bob Johnson"
        license="C 2.1"
        rating={980}
        distance={-4.2}
        percent={40}
        classColor={0xff5888} // Pink/LMP
      />
    </div>
  ),
  decorators: [TelemetryDecorator('/test-data/1747384033336')],
};
