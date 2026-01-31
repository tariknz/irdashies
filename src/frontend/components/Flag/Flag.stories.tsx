import React, { useEffect, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { FlagDisplay } from './Flag';

const meta: Meta<typeof FlagDisplay> = {
  title: 'widgets/Flag',
  component: FlagDisplay,
};

export default meta;

type Story = StoryObj<typeof FlagDisplay>;

const FLAG_COLORS: Record<string, string> = {
  'NO FLAG': 'text-slate-500',
  GREEN: 'text-green-500',
  YELLOW: 'text-yellow-400',
  BLUE: 'text-blue-500',
  WHITE: 'text-white',
  RED: 'text-red-500',
  BLACK: 'text-white',
  MEATBALL: 'text-orange-500',
  CHECKERED: 'text-white',
  DEBRIS: 'text-yellow-400',
};

export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-full">
      {Object.entries(FLAG_COLORS).map(([label, textColor]) => (
        <div key={label} className="flex items-start gap-4">
          <div style={{ width: 360 }}>
            <FlagDisplay label={label} textColor={textColor} showLabel={true} matrixSize={8} />
          </div>
          <div style={{ width: 360 }}>
            <FlagDisplay label={label} textColor={textColor} showLabel={true} matrixSize={16} />
          </div>
          <div style={{ width: 360 }}>
            <FlagDisplay label={label} textColor={textColor} showLabel={true} matrixSize={1} />
          </div>
        </div>
      ))}
    </div>
  ),
};

interface InteractiveArgs {
  flagLabel: string;
  matrixMode: '8x8' | '16x16' | 'uniform';
  animate: boolean;
  blinkPeriod: number;
  showLabel: boolean;
}

export const Interactive: Story<InteractiveArgs> = {
  argTypes: {
    flagLabel: {
      control: { type: 'select' },
      options: Object.keys(FLAG_COLORS),
    },
    matrixMode: {
      control: { type: 'select' },
      options: ['8x8', '16x16', 'uniform'],
    },
    animate: { control: 'boolean' },
    blinkPeriod: { control: { type: 'number', min: 0.1, step: 0.1 } },
    showLabel: { control: 'boolean' },
  },
  args: {
    flagLabel: 'YELLOW',
    matrixMode: '16x16',
    animate: false,
    blinkPeriod: 0.5,
    showLabel: true,
  },
  render: (args) => {
    const [on, setOn] = useState(true);

    useEffect(() => {
      if (!args.animate) {
        setOn(true);
        return;
      }
      setOn(true);
      const periodMs = Math.max(100, Math.floor(args.blinkPeriod * 1000));
      const id = setInterval(() => setOn((v) => !v), periodMs);
      return () => clearInterval(id);
    }, [args.animate, args.blinkPeriod]);

    const matrixSize = args.matrixMode === '8x8' ? 8 : args.matrixMode === '16x16' ? 16 : 1;
    const displayLabel = args.animate && !on ? 'NO FLAG' : args.flagLabel;

    return (
      <div style={{ width: 420 }}>
        <FlagDisplay label={displayLabel} showLabel={args.showLabel} matrixSize={matrixSize} />
      </div>
    );
  },
};
