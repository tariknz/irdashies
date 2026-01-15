import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Tachometer } from './InputTachometer';
import type { ShiftPointSettings } from '../../Settings/types';

// Mock telemetry store
vi.mock('../../../context/TelemetryStore/TelemetryStore', () => ({
  useTelemetryValue: vi.fn(() => 1), // Mock gear 1
}));

describe('Tachometer', () => {
  const mockCarData = {
    carName: 'Ferrari 296 GT3',
    carId: 'ferrari296gt3',
    carClass: 'GT3',
    ledNumber: 6,
    redlineBlinkInterval: 250,
    ledColor: ['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000', '#FFFF0000'],
    ledRpm: [{}]
  };

  const mockShiftSettings: ShiftPointSettings = {
    enabled: true,
    indicatorType: 'glow',
    indicatorColor: '#00ff00',
    carConfigs: {
      'ferrari296gt3': {
        carId: 'ferrari296gt3',
        carName: 'Ferrari 296 GT3',
        gearCount: 6,
        gearShiftPoints: {
          '1': { shiftRpm: 7000 },
        }
      }
    }
  };

  it('renders tachometer with LEDs', () => {
    render(
      <Tachometer
        rpm={5000}
        maxRpm={8000}
        showRpmText={true}
        carData={mockCarData}
      />
    );

    // Should render 6 LEDs (based on car data)
    const leds = screen.getAllByLabelText(/LED \d+/);
    expect(leds).toHaveLength(6);
  });

  it('shows RPM text when enabled', () => {
    render(
      <Tachometer
        rpm={5000}
        maxRpm={8000}
        showRpmText={true}
        carData={mockCarData}
      />
    );

    expect(screen.getByText('5,000')).toBeInTheDocument();
    expect(screen.getByText('RPM')).toBeInTheDocument();
  });

  it('shows visual indicator when custom shift point is reached', () => {
    render(
      <Tachometer
        rpm={7100} // Above 7000 RPM shift point
        maxRpm={8000}
        showRpmText={true}
        gear={1}
        carData={mockCarData}
        carPath="ferrari296gt3"
        shiftPointSettings={mockShiftSettings}
      />
    );

    // Check that SHIFT text is shown when custom shift point is reached
    expect(screen.getByText('SHIFT')).toBeInTheDocument();
  });

  it('does not show visual indicator when below custom shift point', () => {
    render(
      <Tachometer
        rpm={6500} // Below 7000 RPM shift point
        maxRpm={8000}
        showRpmText={true}
        gear={1}
        carData={mockCarData}
        carPath="ferrari296gt3"
        shiftPointSettings={mockShiftSettings}
      />
    );

    // Check that SHIFT text is not shown
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
  });

  it('does not show visual indicator when custom shift points are disabled', () => {
    const disabledSettings = { ...mockShiftSettings, enabled: false };
    
    render(
      <Tachometer
        rpm={7100} // Above 7000 RPM shift point
        maxRpm={8000}
        showRpmText={true}
        gear={1}
        carData={mockCarData}
        carPath="ferrari296gt3"
        shiftPointSettings={disabledSettings}
      />
    );

    // Check that SHIFT text is not shown
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
  });
});