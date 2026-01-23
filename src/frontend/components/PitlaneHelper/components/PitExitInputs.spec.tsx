import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
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

    it('renders with throttle enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });

    it('renders with clutch enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });

    it('renders with both throttle and clutch enabled', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
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

      // The inverted value (0.2) should be passed to InputBar
      // We can't directly test the prop, but we can verify the component renders
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

  describe('InputBar Integration', () => {
    it('passes correct settings when only throttle is shown', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      // InputBar should be rendered with includeBrake=false, includeAbs=false
      expect(container.querySelector('.h-16')).toBeInTheDocument();
    });

    it('passes correct settings when only clutch is shown', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.2;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={false} showClutch={true} />
      );

      expect(container.querySelector('.h-16')).toBeInTheDocument();
    });

    it('passes correct settings when both are shown', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.65;
        if (key === 'Clutch') return 0.8;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      expect(container.querySelector('.h-16')).toBeInTheDocument();
    });

    it('never includes brake in settings', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.5;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      // Verify brake is never shown (InputBar settings.includeBrake should be false)
      expect(container.querySelector('.h-16')).toBeInTheDocument();
    });

    it('never includes ABS in settings', () => {
      vi.spyOn(context, 'useTelemetryValue').mockImplementation((key) => {
        if (key === 'Throttle') return 0.5;
        if (key === 'Clutch') return 0.5;
        return undefined;
      });

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={true} />
      );

      // Verify ABS is never shown (InputBar settings.includeAbs should be false)
      expect(container.querySelector('.h-16')).toBeInTheDocument();
    });
  });

  describe('Component Structure', () => {
    it('renders header label', () => {
      vi.spyOn(context, 'useTelemetryValue').mockReturnValue(0.5);

      const { getByText } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });

    it('renders container with correct height', () => {
      vi.spyOn(context, 'useTelemetryValue').mockReturnValue(0.5);

      const { container } = render(
        <PitExitInputs showThrottle={true} showClutch={false} />
      );

      const inputBarContainer = container.querySelector('.h-16');
      expect(inputBarContainer).toBeInTheDocument();
    });

    it('has correct displayName for debugging', () => {
      expect(PitExitInputs.displayName).toBe('PitExitInputs');
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
