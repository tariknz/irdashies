import type { SlowCarAheadConfig } from '@irdashies/types';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SlowCarAheadDisplay } from './SlowCarAhead';

const mockSettings = (
  overrides: Partial<SlowCarAheadConfig> = {}
): SlowCarAheadConfig => {
  const baseConfig: SlowCarAheadConfig = {
    slowSpeedThreshold: 100,
    stoppedSpeedThreshold: 5,
    maxDistance: 250,
    barThickness: 10,
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  };

  return {
    ...baseConfig,
    ...overrides,
  };
};

describe('SlowCarAheadDisplay', () => {
  const defaultProps = {
    settings: mockSettings(),
    distance: 50,
    isStopped: false,
    isOffTrack: false,
  };

  it('shows distance to car', () => {
    render(<SlowCarAheadDisplay {...defaultProps} />);

    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it.each([
    [true, false, 'bg-red-700'],
    [true, true, 'bg-green-500'],
    [false, true, 'bg-green-500'],
    [false, false, 'bg-amber-500'],
  ])(
    'colors bars based on stopped and off-track status',
    (stopped: boolean, offTrack: boolean, cssClass: string) => {
      const { container } = render(
        <SlowCarAheadDisplay
          {...defaultProps}
          isStopped={stopped}
          isOffTrack={offTrack}
        />
      );

      expect(container.querySelector('#left-line')).toHaveClass(cssClass);
      expect(container.querySelector('#right-line')).toHaveClass(cssClass);
    }
  );

  it.each([
    [0.2, 80],
    [0.5, 50],
    [0.8, 20],
  ])(
    'sizes bars based on distance - closer is larger bars',
    (pctDistanceAway: number, expectedWidth: number) => {
      const { container } = render(
        <SlowCarAheadDisplay
          {...defaultProps}
          distance={defaultProps.settings.maxDistance * pctDistanceAway}
        />
      );

      expect(container.querySelector('#left-line')).toHaveStyle({
        width: `${expectedWidth}%`,
      });
      expect(container.querySelector('#right-line')).toHaveStyle({
        width: `${expectedWidth}%`,
      });
    }
  );
});
