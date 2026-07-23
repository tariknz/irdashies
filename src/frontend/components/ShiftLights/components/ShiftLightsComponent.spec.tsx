import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ShiftPointSettings } from '@irdashies/types';
import { ShiftLightsComponent } from './ShiftLightsComponent';

const settings: ShiftPointSettings = {
  enabled: true,
  indicatorType: 'pulse',
  indicatorColor: '#00ff00',
  carConfigs: {
    testcar: {
      enabled: true,
      carId: 'testcar',
      carName: 'Test Car',
      gearCount: 2,
      redlineRpm: 8000,
      gearShiftPoints: { '1': { shiftRpm: 7000 } },
    },
  },
};

describe('ShiftLightsComponent', () => {
  afterEach(() => vi.useRealTimers());

  it('renders only SHIFT at the configured threshold', () => {
    render(
      <ShiftLightsComponent
        rpm={7000}
        gear={1}
        carId="testcar"
        shiftPointSettings={settings}
      />
    );
    expect(screen.getByText('SHIFT')).toBeInTheDocument();
    expect(screen.queryByLabelText(/LED/)).not.toBeInTheDocument();
  });

  it('hides below threshold and when the car config is disabled', () => {
    const { rerender } = render(
      <ShiftLightsComponent
        rpm={6999}
        gear={1}
        carId="testcar"
        shiftPointSettings={settings}
      />
    );
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
    rerender(
      <ShiftLightsComponent
        rpm={7000}
        gear={1}
        carId="testcar"
        shiftPointSettings={{
          ...settings,
          carConfigs: {
            testcar: { ...settings.carConfigs.testcar, enabled: false },
          },
        }}
      />
    );
    expect(screen.queryByText('SHIFT')).not.toBeInTheDocument();
  });

  it('cleans up the pulse timer', () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = render(
      <ShiftLightsComponent
        rpm={7000}
        gear={1}
        carId="testcar"
        shiftPointSettings={settings}
      />
    );
    act(() => vi.advanceTimersByTime(500));
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
  });
});
