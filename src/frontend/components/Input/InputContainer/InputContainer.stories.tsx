import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputContainer } from './InputContainer';
import { useEffect, useState } from 'react';

const meta: Meta<typeof InputContainer> = {
  component: InputContainer,
};
export default meta;

type Story = StoryObj<typeof InputContainer>;

const RandomTraces = () => {
  const [throttle, setThrottle] = useState(0);
  const [brake, setBrake] = useState(0);
  const [clutch, setClutch] = useState(0);
  const [gear] = useState(2);
  const [speed] = useState(122);
  const [steer, setSteer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setThrottle((value) =>
        Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05))
      );

      setBrake((value) =>
        Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05))
      );

      setClutch((value) =>
        Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05))
      );

      setSteer((value) =>
        Math.max(
          -Math.PI,
          Math.min(Math.PI, value + Math.random() * 0.2 - 0.1),
        )
      );
    }, 1000 / 60);
    return () => clearInterval(interval);
  }, []);
  return (
    <InputContainer
      brake={brake}
      throttle={throttle}
      clutch={clutch}
      gear={gear}
      speed={speed}
      steer={steer}
      settings={{
        trace: {
          enabled: true,
          includeThrottle: true,
          includeBrake: true,
          includeAbs: true,
          includeSteer: true,
        },
        bar: {
          enabled: true,
          includeThrottle: true,
          includeBrake: true,
          includeClutch: true,
          includeAbs: true,
        },
        gear: {
          enabled: true,
          unit: 'auto',
        },
        steer: {
          enabled: true,
          config: {
            style: 'formula',
            color: 'light',
          },
        },
        tachometer: {
          enabled: true,
          showRpmText: true,
        },
        displayOrder: ['trace', 'bar', 'gear', 'steer'],
        showOnlyWhenOnTrack: true,
      }}
    />
  );
};

export const Primary: Story = {
  render: () => 
    (<div className='h-[100px] w-[500px]'>
        <RandomTraces />
      </div>
    ),
  args: {},
};
