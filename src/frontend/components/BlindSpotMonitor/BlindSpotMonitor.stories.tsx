import { Meta, StoryObj } from '@storybook/react-vite';
import { BlindSpotMonitorDisplay } from './BlindSpotMonitor';
import { useEffect, useState } from 'react';

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
    bgOpacity: {
      control: { type: 'range', min: 0, max: 100, step: 5 },
    },
  },
} as Meta<typeof BlindSpotMonitorDisplay>;

type Story = StoryObj<typeof BlindSpotMonitorDisplay>;

export const Primary: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 30,
  },
};

export const CarOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0.5,
    bgOpacity: 30,
  },
};

export const CarOnLeft: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 0,
    leftPercent: -0.5,
    rightPercent: 0,
    bgOpacity: 30,
  },
};

export const CarsOnBothSides: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0.3,
    rightPercent: -0.3,
    bgOpacity: 30,
  },
};

export const CarAheadOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 1.0,
    bgOpacity: 30,
  },
};

export const CarBehindOnLeft: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 0,
    leftPercent: -1.0,
    rightPercent: 0,
    bgOpacity: 30,
  },
};


export const NoBackground: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 0,
  },
};

export const HighBackgroundOpacity: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 80,
  },
};

export const LowBackgroundOpacity: Story = {
  args: {
    show: true,
    leftState: 1,
    rightState: 1,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 10,
  },
};


export const TwoCarsOnLeft: Story = {
  args: {
    show: true,
    leftState: 2,
    rightState: 0,
    leftPercent: 0.2,
    rightPercent: 0,
    bgOpacity: 30,
  },
};

export const TwoCarsOnRight: Story = {
  args: {
    show: true,
    leftState: 0,
    rightState: 2,
    leftPercent: 0,
    rightPercent: -0.2,
    bgOpacity: 30,
  },
};

const CarPassingAnimation = () => {
  const [leftPercent, setLeftPercent] = useState(-1.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLeftPercent((prev) => {
        const speed = 0.02;
        const next = prev + speed;

        if (next >= 1.0) {
          return -1.0;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <BlindSpotMonitorDisplay
      show={true}
      leftState={1}
      rightState={0}
      leftPercent={leftPercent}
      rightPercent={0}
      bgOpacity={30}
    />
  );
};

const CarPassingFromBehindRightAnimation = () => {
  const [rightPercent, setRightPercent] = useState(-1.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRightPercent((prev) => {
        const speed = 0.02;
        const next = prev + speed;

        if (next >= 1.0) {
          return -1.0;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <BlindSpotMonitorDisplay
      show={true}
      leftState={0}
      rightState={1}
      leftPercent={0}
      rightPercent={rightPercent}
      bgOpacity={30}
    />
  );
};

const YouPassingCarOnLeftAnimation = () => {
  const [leftPercent, setLeftPercent] = useState(1.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLeftPercent((prev) => {
        const speed = -0.02;
        const next = prev + speed;

        if (next <= -1.0) {
          return 1.0;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <BlindSpotMonitorDisplay
      show={true}
      leftState={1}
      rightState={0}
      leftPercent={leftPercent}
      rightPercent={0}
      bgOpacity={30}
    />
  );
};

const YouPassingCarOnRightAnimation = () => {
  const [rightPercent, setRightPercent] = useState(1.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setRightPercent((prev) => {
        const speed = -0.02;
        const next = prev + speed;

        if (next <= -1.0) {
          return 1.0;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <BlindSpotMonitorDisplay
      show={true}
      leftState={0}
      rightState={1}
      leftPercent={0}
      rightPercent={rightPercent}
      bgOpacity={30}
    />
  );
};

const CarsPassingBothSidesAnimation = () => {
  const [leftPercent, setLeftPercent] = useState(-1.0);
  const [rightPercent, setRightPercent] = useState(-1.0);

  useEffect(() => {
    const interval = setInterval(() => {
      setLeftPercent((prev) => {
        const speed = 0.02;
        const next = prev + speed;

        if (next >= 1.0) {
          return -1.0;
        }

        return next;
      });
      setRightPercent((prev) => {
        const speed = 0.02;
        const next = prev + speed;

        if (next >= 1.0) {
          return -1.0;
        }

        return next;
      });
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return (
    <BlindSpotMonitorDisplay
      show={true}
      leftState={1}
      rightState={1}
      leftPercent={leftPercent}
      rightPercent={rightPercent}
      bgOpacity={30}
    />
  );
};

export const CarPassingFromBehindLeft: Story = {
  render: () => <CarPassingAnimation />,
};

export const CarPassingFromBehindRight: Story = {
  render: () => <CarPassingFromBehindRightAnimation />,
};

export const YouPassingCarOnLeft: Story = {
  render: () => <YouPassingCarOnLeftAnimation />,
};

export const YouPassingCarOnRight: Story = {
  render: () => <YouPassingCarOnRightAnimation />,
};

export const CarsPassingBothSides: Story = {
  render: () => <CarsPassingBothSidesAnimation />,
};
