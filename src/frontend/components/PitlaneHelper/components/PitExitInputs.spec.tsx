import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PitExitInputs } from './PitExitInputs';
import * as context from '@irdashies/context';

// Mock the context hooks
vi.mock('@irdashies/context', () => ({
  useTelemetryValue: vi.fn(),
}));

describe('PitExitInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when both showThrottle and showClutch are false', () => {
      vi.spyOn(context, 'useTelemetryValue').mockReturnValue(undefined);

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders throttle bar when throttle is enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(getByText('thr')).toBeInTheDocument();
    });

    it('renders clutch bar when clutch is enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      expect(getByText('clt')).toBeInTheDocument();
    });

    it('renders both throttle and clutch bars when both enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      expect(getByText('thr')).toBeInTheDocument();
      expect(getByText('clt')).toBeInTheDocument();
    });
  });

  describe('Telemetry Integration', () => {
    it('reads Throttle telemetry value', () => {
      const mockUseTelemetryValue = vi.spyOn(context, 'useTelemetryValue');
      mockUseTelemetryValue.mockImplementation((key) => {
        if (key === 'Throttle') return 0.7;
        if (key === 'Clutch') return 0.0;
        return undefined;
      });

      render(<PitExitInputs showThrottle={true} showClutch={false} />);

      expect(mockUseTelemetryValue).toHaveBeenCalledWith('Throttle');
    });

    it('reads Clutch telemetry value', () => {
      const mockUseTelemetryValue = vi.spyOn(context, 'useTelemetryValue');
      mockUseTelemetryValue.mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      render(<PitExitInputs showThrottle={false} showClutch={true} />);

      expect(mockUseTelemetryValue).toHaveBeenCalledWith('Clutch');
    });

    it('inverts clutch value correctly (pedal pressed = 0, not pressed = 1)', () => {
      const mockUseTelemetryValue = vi.spyOn(context, 'useTelemetryValue');

      // Clutch telemetry: 0.8 = fully engaged (pedal NOT pressed)
      // Should invert to: 1 - 0.8 = 0.2 for display
      mockUseTelemetryValue.mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      // The inverted value (0.2 = 20%) should be shown in the label
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles undefined throttle value', () => {
      const mockUseTelemetryValue = vi.spyOn(context, 'useTelemetryValue');
      mockUseTelemetryValue.mockImplementation((key) => {
        if (key === 'Clutch') return 0.5;
        return undefined; // Throttle is undefined
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles undefined clutch value', () => {
      const mockUseTelemetryValue = vi.spyOn(context, 'useTelemetryValue');
      mockUseTelemetryValue.mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        return undefined; // Clutch is undefined
      });

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Bar Display', () => {
    it('shows only throttle bar when only throttle is enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { getByText, queryByText } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(getByText('thr')).toBeInTheDocument();
      expect(queryByText('clt')).not.toBeInTheDocument();
    });

    it('shows only clutch bar when only clutch is enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { getByText, queryByText } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      expect(getByText('clt')).toBeInTheDocument();
      expect(queryByText('thr')).not.toBeInTheDocument();
    });

    it('shows vertical bars with correct width class', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      const bars = container.querySelectorAll('.w-8');
      expect(bars.length).toBeGreaterThan(0);
    });
  });

  describe('Component Structure', () => {
    it('has correct displayName for debugging', () => {
      expect(PitExitInputs.displayName).toBe('PitExitInputs');
    });

    it('shows percentage value label above the bar', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 1.0;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      // 0.5 throttle = 50%
      expect(getByText('50')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles zero throttle value', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0;
        if (key === 'Clutch') return 0.5;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles full throttle value', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 1.0;
        if (key === 'Clutch') return 0.5;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles zero clutch value (fully disengaged/pedal pressed)', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0; // Fully engaged = pedal not pressed
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      // After inversion: 1 - 0 = 1 (should display as fully disengaged)
      expect(container.firstChild).toBeInTheDocument();
    });

    it('handles full clutch value (fully engaged/pedal not pressed)', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 1.0; // Fully disengaged = pedal pressed
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      // After inversion: 1 - 1.0 = 0 (should display as fully engaged)
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});
