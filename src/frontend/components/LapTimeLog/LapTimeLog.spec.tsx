import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LapTimeLogDisplay } from './LapTimeLog';
import { LapTimeRow, formatDelta } from './components/LapTimeRow';
import type { LapTimeLogWidgetSettings } from '@irdashies/types';
import { formatTime } from '@irdashies/utils/time';

// Mock settings for tests
const mockSettings = (
  overrides: Partial<LapTimeLogWidgetSettings['config']> = {}
): LapTimeLogWidgetSettings => {
  const baseConfig: LapTimeLogWidgetSettings['config'] = {
    background: { opacity: 80 },
    foreground: { opacity: 70 },
    scale: 100,
    alignment: 'top',
    reverse: false,
    showCurrentLap: true,
    showPredictedLap: true,
    showLastLap: true,
    showBestLap: true,
    delta: {
      enabled: true,
      method: 'bestlap',
    },
    history: {
      enabled: true,
      count: 10,
    },
    sessionVisibility: {
      race: true,
      loneQualify: true,
      openQualify: true,
      practice: true,
      offlineTesting: true,
    },
  };

  return {
    id: 'laptimelog',
    enabled: true,
    config: {
      ...baseConfig,
      ...overrides,
      // Deep merge for nested objects
      delta: { ...baseConfig.delta, ...overrides.delta },
      history: { ...baseConfig.history, ...overrides.history },
    },
  };
};

describe('LapTimeLog helpers', () => {
  describe('formatTime', () => {
    it('should format zero times correctly', () => {
      expect(formatTime(0)).toBe('0:00.000');
    });

    it('should format times under a minute', () => {
      expect(formatTime(59.123)).toBe('0:59.123');
    });

    it('should format times over a minute', () => {
      expect(formatTime(92.456)).toBe('1:32.456');
    });

    it('should pad seconds correctly', () => {
      expect(formatTime(65.1)).toBe('1:05.100');
    });
  });

  describe('formatDelta', () => {
    it('should handle zero or undefined delta', () => {
      expect(formatDelta(undefined)).toBe('---');
      expect(formatDelta(0)).toBe('---');
    });

    it('should format positive delta', () => {
      expect(formatDelta(1.234)).toBe('+1.23');
    });

    it('should format negative delta', () => {
      expect(formatDelta(-0.567)).toBe('-0.57');
    });
  });
});

describe('LapTimeRow', () => {
  it('renders label and time', () => {
    render(<LapTimeRow label="LAST" time={90.123} settings={mockSettings()} />);
    expect(screen.getByText('LAST')).toBeInTheDocument();
    expect(screen.getByText('1:30.123')).toBeInTheDocument();
  });

  it('renders delta when provided', () => {
    render(
      <LapTimeRow label="LAST" time={90.123} delta={-0.5} settings={mockSettings()} />
    );
    expect(screen.getByText('-0.50')).toBeInTheDocument();
  });

  it('hides delta when disabled in settings', () => {
    const settings = mockSettings({ delta: { enabled: false, method: 'bestlap'} });
    render(
      <LapTimeRow label="LAST" time={90.123} delta={-0.5} settings={settings} />
    );
    expect(screen.queryByText('-0.50')).not.toBeInTheDocument();
  });

  it('applies green color for personal best lap', () => {
    render(<LapTimeRow label="LAST" time={90} best={90} settings={mockSettings()} />);
    const timeElement = screen.getByText('1:30.000');
    expect(timeElement).toHaveClass('text-green-400');
  });

  it('applies purple color for overall best lap', () => {
    render(
      <LapTimeRow label="LAST" time={90} best={91} overall={90} settings={mockSettings()} />
    );
    const timeElement = screen.getByText('1:30.000');
    expect(timeElement).toHaveClass('text-purple-400');
  });
});

describe('LapTimeLogDisplay', () => {
  const defaultProps = {
    settings: mockSettings(),
    current: 10.5,
    lastlap: 92.1,
    bestlap: 91.5,
    reference: 91.5,
    delta: -0.20,
    overall: 91.0,
    history: [
      { lap: 10, time: 92.1, delta: 0.6 },
      { lap: 9, time: 91.5, delta: 0.0 },
    ],
  };

  it('renders all sections when enabled', () => {
    render(<LapTimeLogDisplay {...defaultProps} />);

    expect(screen.getByText('0:10.500')).toBeInTheDocument(); // Current
    expect(screen.getByText('1:31.300')).toBeInTheDocument(); // Predicted
    expect(screen.getByText('-0.20')).toBeInTheDocument(); // Predicted Delta
    expect(screen.getByText('LAST')).toBeInTheDocument();
    expect(screen.getByText('BEST')).toBeInTheDocument();
    expect(screen.getByText('LAP 10')).toBeInTheDocument();
  });

  it('hides sections based on settings', () => {
    const settings = mockSettings({
      showCurrentLap: false,
      showPredictedLap: false,
      showLastLap: false,
      showBestLap: false,
      history: { enabled: false, count: 5 },
    });
    render(<LapTimeLogDisplay {...defaultProps} settings={settings} />);

    expect(screen.queryByText('0:10.500')).not.toBeInTheDocument();
    expect(screen.queryByText('1:31.300')).not.toBeInTheDocument();
    expect(screen.queryByText('LAST')).not.toBeInTheDocument();
    expect(screen.queryByText('BEST')).not.toBeInTheDocument();
    expect(screen.queryByText('LAP 10')).not.toBeInTheDocument();
  });

  it('shows last lap time in main timer for first 5 seconds of a new lap', () => {
    const { container } = render(<LapTimeLogDisplay {...defaultProps} current={4.9} />);
    const mainTimer = container.querySelector('#current-lap'); 
    expect(mainTimer).toHaveTextContent('1:32.100');
  });

  it('flashes green for a new personal best lap', () => {
    const { container } = render(
      <LapTimeLogDisplay {...defaultProps} current={4.9} lastlap={91.5} bestlap={91.5} />
    );
    const mainTimerWrapper = container.querySelector('#current-lap');
    expect(mainTimerWrapper).toHaveClass('bg-green-700');
  });

  it('flashes purple for a new session best lap', () => {
    const { container } = render(
      <LapTimeLogDisplay {...defaultProps} current={4.9} lastlap={91.0} bestlap={91.0} overall={91.0} />
    );
    const mainTimerWrapper = container.querySelector('#current-lap');
    expect(mainTimerWrapper).toHaveClass('bg-purple-800');
  });

  it('limits history to count from settings', () => {
    const settings = mockSettings({ history: { enabled: true, count: 1 } });
    render(<LapTimeLogDisplay {...defaultProps} settings={settings} />);
    expect(screen.getByText('LAP 10')).toBeInTheDocument();
    expect(screen.queryByText('LAP 9')).not.toBeInTheDocument();
  });
});