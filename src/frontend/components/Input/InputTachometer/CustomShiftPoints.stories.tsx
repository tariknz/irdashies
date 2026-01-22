import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tachometer } from './InputTachometer';
import { useEffect, useState } from 'react';
import type { ShiftPointSettings } from '../../Settings/types';

// Create a Storybook-specific Tachometer that forces gear to 1
const TachometerForStorybook = (props: Parameters<typeof Tachometer>[0]) => {
  return <Tachometer {...props} />;
};

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
  title: 'widgets/Input/components/CustomShiftPoints',
  argTypes: {
    shiftPointSettings: { table: { disable: true } },
    gearRpmThresholds: { table: { disable: true } },
    ledColors: { table: { disable: true } },
    carData: { table: { disable: true } },
  },
};
export default meta;

type Story = StoryObj<typeof Tachometer>;

// Base car data for consistent testing
const testCarData = {
  carName: 'Ferrari 296 GT3',
  carId: 'ferrari296gt3',
  carClass: 'GT3',
  ledNumber: 6,
  redlineBlinkInterval: 250,
  ledColor: ['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000'],
  ledRpm: [{}]
};

const testGearRpm = [7360, 6760, 6860, 6960, 7060, 7160, 7260];

// Animated RPM component for testing
const AnimatedRPM = ({ 
  indicatorType, 
  shiftRpm = 7000,
  title,
  color = '#00ff00',
  showRpmText = true
}: { 
  indicatorType: 'glow' | 'pulse' | 'border';
  shiftRpm?: number;
  title: string;
  color?: string;
  showRpmText?: boolean;
}) => {
  const [rpm, setRpm] = useState(6500);
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  // Create shift point settings
  const shiftPointSettings: ShiftPointSettings = {
    enabled: true,
    indicatorType,
    indicatorColor: color,
    carConfigs: {
      'ferrari296gt3': {
        carId: 'ferrari296gt3',
        carName: 'Ferrari 296 GT3',
        gearCount: 6,
        gearShiftPoints: {
          '1': { shiftRpm }
        }
      }
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRevLimiter) {
        setRevLimiterTimer((prev) => {
          if (prev <= 0) {
            setIsRevLimiter(false);
            setRpm(6500);
            return 0;
          }
          return prev - 50;
        });
      } else {
        setRpm((prev) => {
          const accelerationRate = 20;
          const next = prev + accelerationRate;
          
          if (next >= 7360) {
            setIsRevLimiter(true);
            setRevLimiterTimer(2000);
            return 7360;
          }
          
          return next;
        });
      }
    }, 120);

    return () => clearInterval(interval);
  }, [isRevLimiter]);

  return (
    <div className="space-y-4 p-6 bg-gray-900 rounded-lg border border-gray-700">
      <h3 className="text-white text-lg font-semibold">{title}</h3>
      <p className="text-gray-400 text-sm">Shift point: {shiftRpm} RPM | Current: {rpm} RPM</p>
      <p className="text-gray-300 text-xs">Gear: 1 | Should show shift: {rpm >= shiftRpm ? 'YES' : 'NO'} | Has config: YES</p>
      <div className="text-yellow-400 text-xs p-2 bg-gray-800 rounded">
        DEBUG: RPM={rpm}, ShiftRPM={shiftRpm}, Triggered={rpm >= shiftRpm ? 'TRUE' : 'FALSE'}, Style={indicatorType}, Color={color}
      </div>
      <div className="p-4 bg-black rounded">
        <TachometerForStorybook 
          rpm={rpm} 
          maxRpm={7360} 
          gear={1}
          carPath="ferrari296gt3"
          showRpmText={showRpmText}
          gearRpmThresholds={testGearRpm}
          ledColors={testCarData.ledColor}
          carData={testCarData}
          shiftPointSettings={shiftPointSettings}
        />
      </div>
    </div>
  );
};

export const BorderStyle: Story = {
  render: () => (
    <AnimatedRPM 
      indicatorType="border"
      title="Border Glow Style"
      color="#ffff00"
    />
  ),
};

export const GlowStyle: Story = {
  render: () => (
    <AnimatedRPM 
      indicatorType="glow"
      title="Glow Effect Style"
      color="#00ff00"
    />
  ),
};

export const PulseStyle: Story = {
  render: () => (
    <AnimatedRPM 
      indicatorType="pulse"
      title="Pulse Effect Style"
      color="#ff0066"
    />
  ),
};

export const WithoutRpmText: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="text-white text-xl font-bold mb-6">Custom Shift Points Without RPM Text</div>
      <p className="text-gray-400 mb-4">RPM box appears only when shift point is active, showing &quot;SHIFT&quot; text</p>
      <AnimatedRPM 
        indicatorType="glow"
        title="Glow Effect - No RPM Text"
        color="#00ff00"
        showRpmText={false}
      />
    </div>
  ),
};

export const WithRpmText: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="text-white text-xl font-bold mb-6">Custom Shift Points With RPM Text</div>
      <p className="text-gray-400 mb-4">RPM box always visible, shows both RPM and &quot;SHIFT&quot; when active</p>
      <AnimatedRPM 
        indicatorType="glow"
        title="Glow Effect - With RPM Text"
        color="#00ff00"
        showRpmText={true}
      />
    </div>
  ),
};

export const Comparison: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="text-white text-xl font-bold mb-6">Shift Point Alert Styles Comparison</div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnimatedRPM 
          indicatorType="border"
          title="Border Glow"
          color="#ffff00"
        />
        <AnimatedRPM 
          indicatorType="glow"
          title="Glow Effect"
          color="#00ff00"
        />
        <AnimatedRPM 
          indicatorType="pulse"
          title="Pulse Effect"
          color="#ff0066"
        />
      </div>
    </div>
  ),
};

export const DifferentShiftPoints: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="text-white text-xl font-bold mb-6">Different Shift Points</div>
      <div className="grid grid-cols-1 gap-6">
        <AnimatedRPM 
          indicatorType="glow"
          shiftRpm={6800}
          title="Early Shift Point (6800 RPM) - Glow - With RPM Text"
          color="#00ff00"
          showRpmText={true}
        />
        <AnimatedRPM 
          indicatorType="border"
          shiftRpm={7000}
          title="Medium Shift Point (7000 RPM) - Border - RPM Text OFF"
          color="#ff6600"
          showRpmText={false}
        />
        <AnimatedRPM 
          indicatorType="pulse"
          shiftRpm={7200}
          title="Late Shift Point (7200 RPM) - Pulse - With RPM Text"
          color="#ff0066"
          showRpmText={true}
        />
      </div>
    </div>
  ),
};