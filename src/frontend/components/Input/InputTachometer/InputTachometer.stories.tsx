import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tachometer } from './InputTachometer';
import { useEffect, useState } from 'react';
import type { ShiftPointSettings } from '../../Settings/types';

const meta: Meta<typeof Tachometer> = {
  component: Tachometer,
  title: 'widgets/Input/components/InputTachometer',
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

// Ferrari 296 GT3 car data example
const Ferrari296GT3 = () => {
  const [rpm, setRpm] = useState(6500);
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  const ferrariCarData = {
    carName: 'Ferrari 296 GT3',
    carId: 'ferrari296gt3',
    carClass: 'GT3',
    ledNumber: 6,
    redlineBlinkInterval: 250,
    ledColor: ['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000'],
    ledRpm: [{}]
  };
  const ferrariGear1Rpm = [7360, 6760, 6860, 6960, 7060, 7160, 7260];

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
          const accelerationRate = 30;
          const next = prev + accelerationRate;
          
          if (next >= 7360) {
            setIsRevLimiter(true);
            setRevLimiterTimer(2000);
            return 7360;
          }
          
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRevLimiter]);

  return (
    <div className="space-y-4">
      <h3 className="text-white text-lg font-semibold">Ferrari 296 GT3 (Gear 1) - 6 LEDs</h3>
      <p className="text-gray-400 text-sm">LED thresholds: 6760, 6860, 6960, 7060, 7160, 7260 RPM</p>
      <Tachometer 
        rpm={rpm} 
        maxRpm={7360} 
        showRpmText={true}
        gearRpmThresholds={ferrariGear1Rpm}
        ledColors={ferrariCarData.ledColor}
        carData={ferrariCarData}
      />
    </div>
  );
};

export const Demo: Story = {
  render: () => <RandomRPM />,
};

export const CustomShiftPointDemo: Story = {
  render: () => <CustomShiftPointDemos />,
};

export const CarComparison: Story = {
  render: () => (
    <div className="space-y-8 p-4">
      <div className="text-white text-xl font-bold mb-6">Car-Specific Tachometer Patterns</div>
      <Ferrari296GT3 />
      <CadillacGTP />
      <SuperFormulaLights />
      <div className="space-y-4">
        <h3 className="text-white text-lg font-semibold">Generic Tachometer (Fallback)</h3>
        <RandomRPM />
      </div>
    </div>
  ),
};

// Cadillac V-Series GTP example
const CadillacGTP = () => {
  const [rpm, setRpm] = useState(4000);
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  const cadillacCarData = {
    carName: 'Cadillac V-Series GTP',
    carId: 'cadillacvseriesrgtp',
    carClass: 'GTP',
    ledNumber: 10,
    redlineBlinkInterval: 0,
    ledColor: ['#FF0000FF', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000', '#FFFFFF00', '#FFFFFF00', '#FF00FF00', '#FF00FF00'],
    ledRpm: [{}]
  };
  // Gear 1: Center-out pattern like Porsche
  const cadillacGear1Rpm = [8250, 4450, 5050, 5850, 6650, 7450, 7450, 6650, 5850, 5050, 4450];

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRevLimiter) {
        setRevLimiterTimer((prev) => {
          if (prev <= 0) {
            setIsRevLimiter(false);
            setRpm(4000);
            return 0;
          }
          return prev - 50;
        });
      } else {
        setRpm((prev) => {
          const accelerationRate = 40;
          const next = prev + accelerationRate;
          
          if (next >= 8250) {
            setIsRevLimiter(true);
            setRevLimiterTimer(2000);
            return 8250;
          }
          
          return next;
        });
      }
    }, 80);

    return () => clearInterval(interval);
  }, [isRevLimiter]);

  return (
    <div className="space-y-4">
      <h3 className="text-white text-lg font-semibold">Cadillac V-Series GTP (Gear 1) - 10 LEDs</h3>
      <p className="text-gray-400 text-sm">Center-out pattern: Outer LEDs (4450), then inward</p>
      <p className="text-gray-300 text-sm">Current RPM: {rpm}</p>
      <Tachometer 
        rpm={rpm} 
        maxRpm={8250} 
        showRpmText={true}
        gearRpmThresholds={cadillacGear1Rpm}
        ledColors={cadillacCarData.ledColor}
        carData={cadillacCarData}
      />
    </div>
  );
};

// Super Formula Lights example
const SuperFormulaLights = () => {
  const [rpm, setRpm] = useState(6000);
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  const sflCarData = {
    carName: 'Super Formula Lights',
    carId: 'superformulalights324',
    carClass: 'SFL',
    ledNumber: 8,
    redlineBlinkInterval: 0,
    ledColor: ['#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000', '#FFFF0000'],
    ledRpm: [{}]
  };
  // All gears same: Simple left-to-right progression, all red LEDs
  const sflGearRpm = [7000, 6200, 6300, 6400, 6500, 6600, 6700, 6800, 6900];

  useEffect(() => {
    const interval = setInterval(() => {
      if (isRevLimiter) {
        setRevLimiterTimer((prev) => {
          if (prev <= 0) {
            setIsRevLimiter(false);
            setRpm(6000);
            return 0;
          }
          return prev - 50;
        });
      } else {
        setRpm((prev) => {
          const accelerationRate = 25;
          const next = prev + accelerationRate;
          
          if (next >= 7000) {
            setIsRevLimiter(true);
            setRevLimiterTimer(2000);
            return 7000;
          }
          
          return next;
        });
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isRevLimiter]);

  return (
    <div className="space-y-4">
      <h3 className="text-white text-lg font-semibold">Super Formula Lights - 8 LEDs</h3>
      <p className="text-gray-400 text-sm">Left-to-right progression: All red LEDs, 100 RPM increments</p>
      <p className="text-gray-300 text-sm">Current RPM: {rpm}</p>
      <Tachometer 
        rpm={rpm} 
        maxRpm={7000} 
        showRpmText={true}
        gearRpmThresholds={sflGearRpm}
        ledColors={sflCarData.ledColor}
        carData={sflCarData}
      />
    </div>
  );
};

// Custom shift point demos with different indicator types
const CustomShiftPointDemos = () => {
  const [rpm, setRpm] = useState(6500);
  const [isRevLimiter, setIsRevLimiter] = useState(false);
  const [, setRevLimiterTimer] = useState(0);

  const ferrariCarData = {
    carName: 'Ferrari 296 GT3',
    carId: 'ferrari296gt3',
    carClass: 'GT3',
    ledNumber: 6,
    redlineBlinkInterval: 250,
    ledColor: ['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000'],
    ledRpm: [{}]
  };
  
  const ferrariGear1Rpm = [7360, 6760, 6860, 6960, 7060, 7160, 7260];

  const glowSettings: ShiftPointSettings = {
    enabled: true,
    indicatorType: 'glow',
    indicatorColor: '#00ff00',
    carConfigs: {
      'ferrari296gt3': {
        carId: 'ferrari296gt3',
        carName: 'Ferrari 296 GT3',
        gearCount: 6,
        gearShiftPoints: { '1': { shiftRpm: 7000 } }
      }
    }
  };

  const borderSettings: ShiftPointSettings = {
    ...glowSettings,
    indicatorType: 'border',
    indicatorColor: '#ff6600',
  };

  const pulseSettings: ShiftPointSettings = {
    ...glowSettings,
    indicatorType: 'pulse',
    indicatorColor: '#ff0066',
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
    <div className="space-y-8">
      <div className="text-white text-xl font-bold mb-6">Custom Shift Point Indicators</div>
      <p className="text-gray-300 text-sm mb-6">Current RPM: {rpm} | Custom shift point: 7000 RPM</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Glow Effect (Green) - With RPM Text</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={true}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={glowSettings}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Glow Effect (Green) - RPM Text OFF</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={false}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={glowSettings}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Border Glow (Orange) - With RPM Text</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={true}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={borderSettings}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Border Glow (Orange) - RPM Text OFF</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={false}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={borderSettings}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Pulse Effect (Pink) - With RPM Text</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={true}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={pulseSettings}
          />
        </div>
        
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">Pulse Effect (Pink) - RPM Text OFF</h3>
          <Tachometer 
            rpm={rpm} 
            maxRpm={7360} 
            gear={1}
            carPath="ferrari296gt3"
            showRpmText={false}
            gearRpmThresholds={ferrariGear1Rpm}
            ledColors={ferrariCarData.ledColor}
            carData={ferrariCarData}
            shiftPointSettings={pulseSettings}
          />
        </div>
      </div>
    </div>
  );
};

