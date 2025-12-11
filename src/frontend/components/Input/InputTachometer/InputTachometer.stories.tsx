import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tachometer } from './InputTachometer';
import { useEffect, useState } from 'react';

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
};
export default meta;

type Story = StoryObj<typeof Tachometer>;

const RandomRPM = () => {
  const [rpm, setRpm] = useState(4250); // Start from 5th LED (4250 RPM out of 8500)
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRevLimiter) {
        // Rev limiter phase - count down timer
        setRevLimiterTimer((prev) => {
          if (prev <= 0) {
            // Reset to 5th LED after 2 seconds
            setIsRevLimiter(false);
            setRpm(4250); // 5th LED position
            return 0;
          }
          return prev - 50;
        });
      } else {
        // Acceleration phase - fast realistic rev up
        setRpm((prev) => {
          const accelerationRate = 120; // Fast acceleration like real life
          const next = prev + accelerationRate;
          
          if (next >= 8500) {
            // Hit rev limiter
            setIsRevLimiter(true);
            setRevLimiterTimer(2000); // 2 seconds
            return 8500;
          }
          
          return next;
        });
      }
    }, 50); // 50ms for smooth animation

    return () => clearInterval(interval);
  }, [isRevLimiter]);

  return <Tachometer rpm={rpm} maxRpm={8500} showRpmText={true} />;
};

export const Demo: Story = {
  render: () => <RandomRPM />,
};
