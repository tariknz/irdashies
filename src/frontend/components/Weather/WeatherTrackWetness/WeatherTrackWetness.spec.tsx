import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WeatherTrackWetness } from './WeatherTrackWetness';

describe('WeatherTrackWetness', () => {
  it('renders "Unknown" for invalid moisture values', () => {
    render(<WeatherTrackWetness trackMoisture={8} />);
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('displays correct wetness states for different moisture levels', () => {
    const testCases = [
      { moisture: 1, expected: 'Dry' },
      { moisture: 2, expected: 'Mostly Dry' },
      { moisture: 3, expected: 'Very Lightly Wet' },
      { moisture: 4, expected: 'Lightly Wet' },
      { moisture: 5, expected: 'Moderately Wet' },
      { moisture: 6, expected: 'Very Wet' },
      { moisture: 7, expected: 'Extremely Wet' },
    ];

    testCases.forEach(({ moisture, expected }) => {
      const { rerender } = render(<WeatherTrackWetness trackMoisture={moisture} />);
      expect(screen.getByText(expected)).toBeInTheDocument();
      rerender(<></>); // Clean up between tests
    });
  });

  it('calculates correct wetness percentage', () => {
    const testCases = [
      { moisture: 1, expected: '0%' }, // Min wetness = 0%
      { moisture: 4, expected: '50%' }, // Middle wetness = 50%
      { moisture: 7, expected: '100%' }, // Max wetness = 100%
    ];

    testCases.forEach(({ moisture, expected }) => {
      const { rerender, container } = render(<WeatherTrackWetness trackMoisture={moisture} />);
      const progressBar = container.querySelector('[style*="width"]');
      expect(progressBar).toHaveStyle(`width: ${expected}`);
      rerender(<></>); // Clean up between tests
    });
  });

  it('renders Sun and Drop icons', () => {
    const { container } = render(<WeatherTrackWetness />);
    // Since Phosphor icons are rendered as SVGs, we can check for their presence
    expect(container.querySelectorAll('svg')).toHaveLength(2);
  });
}); 