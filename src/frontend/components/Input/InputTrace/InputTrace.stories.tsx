import type { Meta, StoryObj } from '@storybook/react-vite';
import { InputTrace } from './InputTrace';
import { useEffect, useState } from 'react';

const meta: Meta<typeof InputTrace> = {
  component: InputTrace,
};
export default meta;

const Traces = ({ brakeAbsActive }: { brakeAbsActive: boolean }) => {
  const [throttle, setThrottle] = useState(0);
  const [brake, setBrake] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setThrottle((value) =>
        Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05))
      );

      setBrake((value) =>
        Math.max(0, Math.min(1, value + Math.random() * 0.1 - 0.05))
      );
    }, 1000 / 60);

    return () => clearInterval(interval);
  }, []);
  return (
    <InputTrace
      input={{ brake, throttle, brakeAbsActive: brakeAbsActive ?? false }}
      settings={{ includeBrake: true, includeThrottle: true }}
    />
  );
};

export const Primary: StoryObj<typeof Traces> = {
  render: (args: { brakeAbsActive: boolean }) => <Traces brakeAbsActive={args.brakeAbsActive} />,
  args: {
    brakeAbsActive: false,
  } as { brakeAbsActive: boolean },
};

export const OutsideRange: StoryObj<typeof InputTrace> = {
  render: (args) => {
    const [input, setInput] = useState({ brake: 2, throttle: -1, brakeAbsActive: false });
    useEffect(() => {
      const interval = setInterval(() => {
        setInput(() => ({
          brake: args.input.brake ?? 0,
          throttle: args.input.throttle ?? 0,
          brakeAbsActive: args.input.brakeAbsActive ?? false,
        }));
      }, 1000 / 60);

      return () => clearInterval(interval);
    }, [args.input.brake, args.input.throttle, args.input.brakeAbsActive]);

    return (
      <InputTrace
        input={input}
        settings={{ includeBrake: true, includeThrottle: true }}
      />
    );
  },
  args: {
    input: {
      brake: 2,
      throttle: -1,
      brakeAbsActive: true,
    },
  },
};
