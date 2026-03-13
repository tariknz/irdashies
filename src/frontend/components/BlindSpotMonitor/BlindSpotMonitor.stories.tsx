import { Meta, StoryObj } from '@storybook/react-vite';
import {
  BlindSpotMonitorDisplay,
  BlindSpotMonitorDisplayProps,
} from './BlindSpotMonitor';
import { useEffect, useState } from 'react';
import { CarLeftRight } from '@irdashies/types';

type BlindSpotMonitorStoryProps = Omit<
  BlindSpotMonitorDisplayProps,
  'indicatorColor'
> & { indicatorColor?: string };

const BlindSpotMonitorDisplayStory = ({
  indicatorColor,
  ...props
}: BlindSpotMonitorStoryProps) => (
  <BlindSpotMonitorDisplay
    {...props}
    indicatorColor={
      indicatorColor ? parseInt(indicatorColor.replace('#', ''), 16) : undefined
    }
  />
);

export default {
  component: BlindSpotMonitorDisplayStory,
  title: 'widgets/BlindSpotMonitor',
  decorators: [
    (Story) => (
      <div className="w-[500px] m-5 h-[300px]">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    show: {
      control: 'boolean',
    },
    leftState: {
      control: { type: 'select' },
      options: [
        CarLeftRight.Off,
        CarLeftRight.Clear,
        CarLeftRight.CarLeft,
        CarLeftRight.CarRight,
        CarLeftRight.Cars2Left,
        CarLeftRight.Cars2Right,
      ] as CarLeftRight[],
    },
    rightState: {
      control: { type: 'select' },
      options: [
        CarLeftRight.Off,
        CarLeftRight.Clear,
        CarLeftRight.CarLeft,
        CarLeftRight.CarRight,
        CarLeftRight.Cars2Left,
        CarLeftRight.Cars2Right,
      ] as CarLeftRight[],
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
    width: {
      control: { type: 'range', min: 5, max: 100, step: 1 },
    },
    borderSize: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
    },
    indicatorColor: {
      control: { type: 'color' },
    },
  },
} as Meta<typeof BlindSpotMonitorDisplayStory>;

type Story = StoryObj<typeof BlindSpotMonitorDisplayStory>;

export const Primary: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.Off,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 30,
    width: 20,
    borderSize: 1,
    indicatorColor: '#f5a623',
  },
};

export const CarOnRight: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.Off,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0,
    rightPercent: 0.5,
    bgOpacity: 30,
  },
};

export const CarOnLeft: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.CarLeft,
    rightState: CarLeftRight.Off,
    leftPercent: -0.5,
    rightPercent: 0,
    bgOpacity: 30,
  },
};

export const CarsOnBothSides: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.CarLeft,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0.3,
    rightPercent: -0.3,
    bgOpacity: 30,
  },
};

export const NoBackground: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.CarLeft,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 0,
  },
};

export const HighBackgroundOpacity: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.CarLeft,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 80,
  },
};

export const LowBackgroundOpacity: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.CarLeft,
    rightState: CarLeftRight.CarRight,
    leftPercent: 0,
    rightPercent: 0,
    bgOpacity: 10,
  },
};

export const TwoCarsOnLeft: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.Cars2Left,
    rightState: CarLeftRight.Off,
    leftPercent: 0.2,
    rightPercent: 0,
    bgOpacity: 30,
  },
};

export const TwoCarsOnRight: Story = {
  args: {
    show: true,
    leftState: CarLeftRight.Off,
    rightState: CarLeftRight.Cars2Right,
    leftPercent: 0,
    rightPercent: -0.2,
    bgOpacity: 30,
  },
};

type AnimationProps = Pick<
  BlindSpotMonitorDisplayProps,
  'width' | 'borderSize' | 'bgOpacity' | 'indicatorColor'
>;

const CarPassingAnimation = (props: AnimationProps) => {
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
      leftState={CarLeftRight.CarLeft}
      rightState={CarLeftRight.Off}
      leftPercent={leftPercent}
      rightPercent={0}
      disableTransition={false}
      {...props}
    />
  );
};

const CarPassingFromBehindRightAnimation = (props: AnimationProps) => {
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
      leftState={CarLeftRight.Off}
      rightState={CarLeftRight.CarRight}
      leftPercent={0}
      rightPercent={rightPercent}
      disableTransition={false}
      {...props}
    />
  );
};

const YouPassingCarOnLeftAnimation = (props: AnimationProps) => {
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
      leftState={CarLeftRight.CarLeft}
      rightState={CarLeftRight.Off}
      leftPercent={leftPercent}
      rightPercent={0}
      disableTransition={false}
      {...props}
    />
  );
};

const YouPassingCarOnRightAnimation = (props: AnimationProps) => {
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
      leftState={CarLeftRight.Off}
      rightState={CarLeftRight.CarRight}
      leftPercent={0}
      rightPercent={rightPercent}
      disableTransition={false}
      {...props}
    />
  );
};

const CarsPassingBothSidesAnimation = (props: AnimationProps) => {
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
      leftState={CarLeftRight.CarLeft}
      rightState={CarLeftRight.CarRight}
      leftPercent={leftPercent}
      rightPercent={rightPercent}
      disableTransition={false}
      {...props}
    />
  );
};

const toAnimationProps = (
  args: BlindSpotMonitorStoryProps
): AnimationProps => ({
  width: args.width,
  borderSize: args.borderSize,
  bgOpacity: args.bgOpacity,
  indicatorColor: args.indicatorColor
    ? parseInt(args.indicatorColor.replace('#', ''), 16)
    : undefined,
});

export const CarPassingFromBehindLeft: Story = {
  render: (args) => <CarPassingAnimation {...toAnimationProps(args)} />,
};

export const CarPassingFromBehindRight: Story = {
  render: (args) => (
    <CarPassingFromBehindRightAnimation {...toAnimationProps(args)} />
  ),
};

export const YouPassingCarOnLeft: Story = {
  render: (args) => (
    <YouPassingCarOnLeftAnimation {...toAnimationProps(args)} />
  ),
};

export const YouPassingCarOnRight: Story = {
  render: (args) => (
    <YouPassingCarOnRightAnimation {...toAnimationProps(args)} />
  ),
};

export const CarsPassingBothSides: Story = {
  args: {
    width: 61,
    borderSize: 3,
    indicatorColor: '#d700ff',
  },

  render: (args) => (
    <CarsPassingBothSidesAnimation {...toAnimationProps(args)} />
  ),
};
