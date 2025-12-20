import { Meta, StoryObj } from '@storybook/react-vite';
import { BlindSpotMonitorDisplay } from './BlindSpotMonitor';

export default {
  component: BlindSpotMonitorDisplay,
  decorators: [
    (Story) => (
      <div className='w-[500px] m-5 h-[500px]'>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    show: {
      control: 'boolean',
    },
    leftState: {
      control: { type: 'range', min: 0, max: 2, step: 1 },
    },
    rightState: {
      control: { type: 'range', min: 0, max: 2, step: 1 },
    },
    leftPercent: {
      control: { type: 'range', min: -1, max: 1, step: 0.1 },
    },
    rightPercent: {
      control: { type: 'range', min: -1, max: 1, step: 0.1 },
    },
    'settings.lineColor': {
      control: 'color',
    },
    'settings.lineOpacity': {
      control: { type: 'range', min: 0, max: 100, step: 5 },
    },
    'settings.lineWidth': {
      control: { type: 'range', min: 1, max: 80, step: 1 },
    },
  },
} as Meta<typeof BlindSpotMonitorDisplay>;

type Story = StoryObj<typeof BlindSpotMonitorDisplay>;

const defaultSettings = {
  lineColor: '#ffffff',
  lineOpacity: 100,
  lineWidth: 5,
  distAhead: 4,
  distBehind: 4,
};

export const Primary: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    settings: defaultSettings,
  },
};

export const CarOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0.5,
    settings: defaultSettings,
  },
};

export const CarOnLeft: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 0,
    leftPercent: -0.5,
    rightPercent: 0,
    settings: defaultSettings,
  },
};

export const CarsOnBothSides: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0.3,
    rightPercent: -0.3,
    settings: defaultSettings,
  },
};

export const CarAheadOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 1.0,
    settings: defaultSettings,
  },
};

export const CarBehindOnLeft: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 0,
    leftPercent: -1.0,
    rightPercent: 0,
    settings: defaultSettings,
  },
};


export const WithBackground: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    settings: {
      ...defaultSettings,
      lineColor: '#ff0000',
      bgColor: '#000000',
      bgOpacity: 50,
      bgWidth: 10,
    },
  },
};


export const ThinLines: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    settings: {
      ...defaultSettings,
      lineOpacity: 80,
      lineWidth: 2,
    },
  },
};

export const ThickLines: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    settings: {
      ...defaultSettings,
      lineWidth: 15,
      bgColor: '#000000',
      bgOpacity: 30,
      bgWidth: 20,
    },
  },
};

export const LowOpacity: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    settings: {
      ...defaultSettings,
      lineOpacity: 40,
    },
  },
};


export const TwoCarsOnLeft: Story = {
  args: {
    show: true,
    leftState: 2,
    rightState: 0,
    leftPercent: 0.2,
    rightPercent: 0,
    settings: defaultSettings,
  },
};

export const TwoCarsOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 2,
    leftPercent: 0,
    rightPercent: -0.2,
    settings: defaultSettings,
  },
};
