import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ShiftLight } from '../ShiftLightComponent/ShiftLightComponent';
import type { ShiftPointSettings } from '@irdashies/types';

// Mock telemetry store
vi.mock('../../../context/TelemetryStore/TelemetryStore', () => ({
  useTelemetryValue: vi.fn(() => 1), // Mock gear 1
}));

describe('ShiftLight', () => {
  const mockCarData = {
    carName: 'Ferrari 296 GT3',
    carId: 'ferrari296gt3',
    carClass: 'GT3',
    ledNumber: 6,
    redlineBlinkInterval: 250,
    ledColor: [],
    ledRpm: [],
  };

  const mockShiftSettings: ShiftPointSettings = {
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
        gearShiftPoints: {
          '1': { shiftRpm: 7000 },
        },
      },
    },
  };

  it('renders without crashing', () => {
    const { container } = render(<ShiftLight rpm={3000} maxRpm={8500} />);
    expect(container).toBeInTheDocument();
  });

  it('renders RPM text display', () => {
    const { container } = render(
      <ShiftLight rpm={3000} maxRpm={8500} showRpmText={true} />
    );

    // Should have RPM display text
    const rpmDisplay = container.querySelector('#rpm-text');
    expect(rpmDisplay).toBeInTheDocument();
    // toLocaleString in tests uses dot instead of comma
    expect(rpmDisplay?.textContent).toMatch(/3[,.]000/);
  });

  it('shows RPM text when enabled', () => {
    render(
      <ShiftLight
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
      <ShiftLight
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
      <ShiftLight
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
      <ShiftLight
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
  it('respects the per-car enable switch in the rendered cue', () => {
    render(
      <ShiftLight
        rpm={7100}
        maxRpm={8000}
        gear={1}
        carPath="Ferrari 296 GT3"
        shiftPointSettings={{
          ...mockShiftSettings,
          carConfigs: {
            ferrari296gt3: {
              ...mockShiftSettings.carConfigs.ferrari296gt3,
              enabled: false,
            },
          },
        }}
      />
    );
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
  });

  it('hides the empty box without RPM text or enabled car settings', () => {
    const { container } = render(
      <ShiftLight rpm={3000} maxRpm={8000} showRpmText={false} />
    );
    expect(container.querySelector('#rpm-text')).not.toBeInTheDocument();
  });

  it('keeps the configured idle box and shows SHIFT without RPM text', () => {
    const { rerender, container } = render(
      <ShiftLight
        rpm={6500}
        maxRpm={8000}
        gear={1}
        carPath="Ferrari 296 GT3"
        showRpmText={false}
        shiftPointSettings={mockShiftSettings}
      />
    );
    expect(container.querySelector('#rpm-text')).toBeInTheDocument();
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
    rerender(
      <ShiftLight
        rpm={7100}
        maxRpm={8000}
        gear={1}
        carPath="Ferrari 296 GT3"
        showRpmText={false}
        shiftPointSettings={mockShiftSettings}
      />
    );
    expect(screen.getByText('SHIFT')).toBeInTheDocument();
  });
  it('shows SHIFT at the iRacing threshold without custom settings', () => {
    const { rerender } = render(
      <ShiftLight rpm={6800} maxRpm={8000} gear={4} shiftRpm={6900} />
    );
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
    rerender(<ShiftLight rpm={6900} maxRpm={8000} gear={4} shiftRpm={6900} />);
    expect(screen.getByText('SHIFT')).toBeInTheDocument();
  });

  it('falls back to 90% of redline and works with RPM text hidden', () => {
    render(
      <ShiftLight rpm={7200} maxRpm={8000} gear={2} showRpmText={false} />
    );
    expect(screen.getByText('SHIFT')).toBeInTheDocument();
  });

  it.each([0, -1])('does not give an automatic cue in gear %i', (gear) => {
    render(<ShiftLight rpm={7500} maxRpm={8000} gear={gear} shiftRpm={6900} />);
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
  });
});
