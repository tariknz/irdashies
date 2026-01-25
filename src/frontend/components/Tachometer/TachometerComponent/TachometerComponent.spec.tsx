import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Tachometer } from './TachometerComponent';
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
        enabled: true,
        carId: 'ferrari296gt3',
        carName: 'Ferrari 296 GT3',
        gearCount: 6,
        redlineRpm: 8000,
        gearShiftPoints: {
          '1': { shiftRpm: 7000 },
        }
      }
    }
  };

  it('renders without crashing', () => {
    const { container } = render(
      <Tachometer rpm={3000} maxRpm={8500} />
    );
    expect(container).toBeInTheDocument();
  });

  it('renders LED container', () => {
    const { container } = render(
      <Tachometer rpm={3000} maxRpm={8500} />
    );
    const ledContainer = container.querySelector('.flex.gap-1');
    expect(ledContainer).toBeInTheDocument();
  });

  it('renders the correct number of LED lights (10)', () => {
    const { container } = render(
      <Tachometer rpm={3000} maxRpm={8500} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    expect(ledElements.length).toBe(10);
  });

  it('renders car-specific number of LED lights', () => {
    const { container } = render(
      <Tachometer 
        rpm={3000} 
        maxRpm={8500} 
        ledColors={['#FFFF0000', '#FF00FF00', '#FF00FF00', '#FFFFFF00', '#FFFFFF00', '#FFFF0000']}
      />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    expect(ledElements.length).toBe(5); // ledColors.length - 1 (subtract redline color)
  });

  it('lights up correct number of LEDs based on RPM percentage', () => {
    const { container } = render(
      <Tachometer rpm={4250} maxRpm={8500} shiftRpm={7650} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // Check first 6 LEDs are lit - 4250 RPM is ~55% of 7650 shift RPM
    for (let i = 0; i < 6; i++) {
      const bgColor = (ledElements[i] as HTMLElement).style.backgroundColor;
      expect(bgColor).toBeTruthy();
    }
    
    // Check remaining LEDs are dark
    for (let i = 6; i < 10; i++) {
      const bgColor = (ledElements[i] as HTMLElement).style.backgroundColor;
      expect(bgColor).toBe('rgb(31, 41, 55)');
    }
  });

  it('shows yellow LEDs at 70-80% RPM range', () => {
    const { container } = render(
      <Tachometer rpm={6375} maxRpm={8500} shiftRpm={7650} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // Check 8th LED is yellow (index 7)
    const led8Color = (ledElements[7] as HTMLElement).style.backgroundColor;
    expect(led8Color).toBe('rgb(234, 179, 8)'); // Yellow #eab308
  });

  it('shows purple LED at shift RPM', () => {
    const { container } = render(
      <Tachometer rpm={7650} maxRpm={8500} shiftRpm={7650} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // At shift RPM, last LED should be purple
    const lastLedColor = (ledElements[9] as HTMLElement).style.backgroundColor;
    expect(lastLedColor).toBe('rgb(168, 85, 247)'); // Purple #a855f7
  });

  it('handles zero RPM correctly', () => {
    const { container } = render(
      <Tachometer rpm={0} maxRpm={8500} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // All LEDs should be dark
    ledElements.forEach(led => {
      expect((led as HTMLElement).style.backgroundColor).toBe('rgb(31, 41, 55)');
    });
  });

  it('handles maximum RPM correctly', () => {
    const { container } = render(
      <Tachometer rpm={8500} maxRpm={8500} shiftRpm={7650} blinkRpm={8245} />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // All 10 LEDs should be lit
    expect(ledElements.length).toBe(10);
    const firstLedColor = (ledElements[0] as HTMLElement).style.backgroundColor;
    expect(firstLedColor).toBeTruthy();
  });

  it('uses car-specific RPM thresholds when available', () => {
    const gearRpmThresholds = [7500, 4500, 5000, 5500, 6000, 6500, 7000];
    const { container } = render(
      <Tachometer 
        rpm={5250} 
        maxRpm={8500} 
        gearRpmThresholds={gearRpmThresholds}
      />
    );
    const ledElements = container.querySelectorAll('.rounded-full');
    
    // At 5250 RPM, should light up LEDs with thresholds <= 5250
    // That would be: 4500, 5000 (indices 1, 2 in the array, so LEDs 0, 1)
    for (let i = 0; i < 2; i++) {
      const bgColor = (ledElements[i] as HTMLElement).style.backgroundColor;
      expect(bgColor).toBeTruthy();
      expect(bgColor).not.toBe('rgb(31, 41, 55)');
    }
  });

  it('renders RPM text display', () => {
    const { container } = render(
      <Tachometer rpm={3000} maxRpm={8500} showRpmText={true} />
    );
    
    // Should have RPM display text
    const rpmDisplay = container.querySelector('.font-mono');
    expect(rpmDisplay).toBeInTheDocument();
    // toLocaleString in tests uses dot instead of comma
    expect(rpmDisplay?.textContent).toMatch(/3[,.]000/);
  });

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