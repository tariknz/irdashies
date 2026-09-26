import type { Meta, StoryObj } from '@storybook/react-vite';
import { ShiftLight } from './ShiftLightComponent';
import { useEffect, useState } from 'react';
import type { ShiftPointSettings } from '@irdashies/types';

const meta: Meta<typeof ShiftLight> = {
  component: ShiftLight,
  title: 'widgets/ShiftLight',
};
export default meta;

type Story = StoryObj<typeof ShiftLight>;

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

  return (
    <div className="h-30 w-150">
      <ShiftLight
        rpm={rpm}
        maxRpm={8500}
        showRpmText={true}
        rpmOrientation="bottom"
      />
    </div>
  );
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
    <div className="h-30 w-150">
        <ShiftLight
          rpm={rpm}
          maxRpm={7360}
          showRpmText={true}
          gearRpmThresholds={ferrariGear1Rpm}
          carData={ferrariCarData}
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
  };

  const glowSettings: ShiftPointSettings = {
    enabled: true,
    indicatorType: 'glow',
    indicatorColor: '#00ff00',
    carConfigs: {
      ferrari296gt3: {
        enabled: true,
        carId: 'ferrari296gt3',
        carName: 'Ferrari 296 GT3',
        gearCount: 6,
        redlineRpm: 8000,
        gearShiftPoints: { '1': { shiftRpm: 7000 } },
      },
    },
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
      <div className="text-white text-xl font-bold mb-6">
        Custom Shift Point Indicators
      </div>
      <p className="text-gray-300 text-sm mb-6">
        Current RPM: {rpm} | Custom shift point: 7000 RPM
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Glow Effect (Green) - With RPM Text
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={true}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={glowSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Glow Effect (Green) - RPM Text OFF
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={false}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={glowSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Border Glow (Orange) - With RPM Text
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={true}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={borderSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Border Glow (Orange) - RPM Text OFF
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={false}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={borderSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Pulse Effect (Pink) - With RPM Text
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={true}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={pulseSettings}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-white text-lg font-semibold">
            Pulse Effect (Pink) - RPM Text OFF
          </h3>
          <div className="h-30 w-150">
            <ShiftLight
              rpm={rpm}
              maxRpm={7360}
              gear={1}
              carPath="ferrari296gt3"
              showRpmText={false}
              gearRpmThresholds={ferrariGear1Rpm}
              carData={ferrariCarData}
              shiftPointSettings={pulseSettings}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
