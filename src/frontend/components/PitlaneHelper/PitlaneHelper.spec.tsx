import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PitlaneHelper } from './PitlaneHelper';
import * as context from '@irdashies/context';

// Mock all the context hooks
vi.mock('@irdashies/context', () => ({
  useTelemetryValue: vi.fn(),
  useDashboard: vi.fn(),
}));

// Mock the custom hooks
vi.mock('./hooks/usePitlaneHelperSettings', () => ({
  usePitlaneHelperSettings: vi.fn(),
}));

vi.mock('./hooks/usePitSpeed', () => ({
  usePitSpeed: vi.fn(),
}));

vi.mock('./hooks/usePitboxPosition', () => ({
  usePitboxPosition: vi.fn(),
}));

vi.mock('./hooks/usePitlaneVisibility', () => ({
  usePitlaneVisibility: vi.fn(),
}));

vi.mock('./hooks/usePitLimiterWarning', () => ({
  usePitLimiterWarning: vi.fn(),
}));

vi.mock('./hooks/usePitlaneTraffic', () => ({
  usePitlaneTraffic: vi.fn(),
}));

import { usePitlaneHelperSettings } from './hooks/usePitlaneHelperSettings';
import { usePitSpeed } from './hooks/usePitSpeed';
import { usePitboxPosition } from './hooks/usePitboxPosition';
import { usePitlaneVisibility } from './hooks/usePitlaneVisibility';
import { usePitLimiterWarning } from './hooks/usePitLimiterWarning';
import { usePitlaneTraffic } from './hooks/usePitlaneTraffic';

describe('PitlaneHelper', () => {
  const defaultConfig = {
    showMode: 'approaching' as const,
    approachDistance: 200,
    earlyPitboxThreshold: 75,
    progressBarOrientation: 'vertical' as const,
    showSpeedBar: true,
    background: { opacity: 80 },
    showPitExitInputs: false,
    showInputsPhase: 'always' as const,
    pitExitInputs: { throttle: true, clutch: true },
    enablePitLimiterWarning: true,
    enableEarlyPitboxWarning: true,
    showPitlaneTraffic: true,
  };

  const defaultSpeedResult = {
    limitKph: 72,
    limitMph: 45,
    speedKph: 67,
    speedMph: 41.6,
    deltaKph: -5.0,
    deltaMph: -3.1,
    colorClass: 'text-green-500',
    isPulsing: false,
    isSpeeding: false,
    isSeverelyOver: false,
  };

  const defaultPositionResult = {
    distanceToPitEntry: 0,
    distanceToPit: 0,
    distanceToPitExit: 0,
    progressPercent: 0,
    isApproaching: false,
    pitboxPct: 0,
    playerPct: 0,
    isEarlyPitbox: false,
  };

  const defaultLimiterWarning = {
    showWarning: false,
    warningText: '',
    isTeamRaceWarning: false,
  };

  const defaultTraffic = {
    carsAhead: 0,
    carsBehind: 0,
    totalCars: 0,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(context.useDashboard).mockReturnValue({
      isDemoMode: false,
      editMode: false,
      currentDashboard: undefined,
      onDashboardUpdated: vi.fn(),
      resetDashboard: vi.fn(),
      bridge: {} as never,
      version: '0.0.0',
      toggleDemoMode: vi.fn(),
      containerBoundsInfo: null,
      currentProfile: null,
      profiles: [],
      createProfile: vi.fn(),
      deleteProfile: vi.fn(),
      renameProfile: vi.fn(),
      switchProfile: vi.fn(),
      refreshProfiles: vi.fn(),
    });

    vi.mocked(usePitlaneHelperSettings).mockReturnValue(defaultConfig);
    vi.mocked(usePitSpeed).mockReturnValue(defaultSpeedResult);
    vi.mocked(usePitboxPosition).mockReturnValue(defaultPositionResult);
    vi.mocked(usePitlaneVisibility).mockReturnValue(true);
    vi.mocked(usePitLimiterWarning).mockReturnValue(defaultLimiterWarning);
    vi.mocked(usePitlaneTraffic).mockReturnValue(defaultTraffic);
  });

  describe('Visibility', () => {
    it('renders nothing when not visible', () => {
      vi.mocked(usePitlaneVisibility).mockReturnValue(false);

      const { container } = render(<PitlaneHelper />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when visible', () => {
      vi.mocked(usePitlaneVisibility).mockReturnValue(true);

      const { container } = render(<PitlaneHelper />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('Telemetry Detection - Surface vs OnPitRoad', () => {
    it('detects on track (Surface=3, OnPitRoad=false)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 3;
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPitEntry: 150, // Approaching
      });

      const { container } = render(<PitlaneHelper />);

      // Should show pit entry countdown when approaching from track
      expect(container.firstChild).toBeInTheDocument();
    });

    it('detects blend zone (Surface=2, OnPitRoad=false) BEFORE pit entry line', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 2;
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPitEntry: 50, // Still showing distance to pit entry
      });

      const { getByText } = render(<PitlaneHelper />);

      // Should still show pit entry countdown in blend zone
      expect(getByText('Pit Entry')).toBeInTheDocument();
    });

    it('detects blend zone without pit entry data (Surface=2, OnPitRoad=false, no distance)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 2;
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPitEntry: 0, // No pit entry position detected yet
      });

      const { getByText } = render(<PitlaneHelper />);

      // Should show "Entering Pit Lane" message
      expect(getByText('Entering Pit Lane')).toBeInTheDocument();
    });

    it('detects on pit road AFTER crossing pit entry line (OnPitRoad=true)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 2;
        if (key === 'OnPitRoad') return true; // Crossed pit entry line
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 45, // Approaching pitbox
      });

      const { getByText } = render(<PitlaneHelper />);

      // Should show pitbox countdown, NOT pit entry
      expect(getByText('Pitbox')).toBeInTheDocument();
    });

    it('detects in pitbox (Surface=1)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 1;
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 2, // At pitbox
      });

      const { getByText } = render(<PitlaneHelper />);

      // Should show "At Pitbox" when within 5m
      expect(getByText('At Pitbox')).toBeInTheDocument();
    });
  });

  describe('Countdown Bar Display Logic', () => {
    it('shows pit entry countdown when approaching (not on pit road)', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'PlayerTrackSurface') return 3;
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPitEntry: 150,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Pit Entry')).toBeInTheDocument();
    });

    it('shows pitbox countdown when on pit road', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 50,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Pitbox')).toBeInTheDocument();
    });

    it('shows past pitbox countdown when past pitbox', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: -25, // Past pitbox
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Past Pitbox')).toBeInTheDocument();
    });

    it('shows both pitbox and pit exit countdown side-by-side when past pitbox', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: -25, // Past pitbox
        distanceToPitExit: 80, // Approaching exit
      });

      const { getByText } = render(<PitlaneHelper />);

      // Both should be visible
      expect(getByText('Past Pitbox')).toBeInTheDocument();
      expect(getByText('Pit Exit')).toBeInTheDocument();
    });

    it('hides pit exit countdown when distance exceeds 150m', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: -25,
        distanceToPitExit: 200, // Too far
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('Pit Exit')).not.toBeInTheDocument();
    });

    it('hides pit entry countdown when distance exceeds approachDistance', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPitEntry: 250, // Beyond approach distance (200m default)
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('Pit Entry')).not.toBeInTheDocument();
    });
  });

  describe('Speed Display', () => {
    it('displays speed delta in km/h when limitKph > limitMph', () => {
      vi.mocked(usePitSpeed).mockReturnValue({
        limitKph: 72,
        limitMph: 45,
        speedKph: 67,
        speedMph: 41.6,
        deltaKph: -5.0,
        deltaMph: -3.1,
        colorClass: 'text-green-500',
        isPulsing: false,
        isSpeeding: false,
        isSeverelyOver: false,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText(/-5\.0 km\/h/)).toBeInTheDocument();
      expect(getByText(/Limit: 72 km\/h/)).toBeInTheDocument();
    });

    it('displays speed delta in mph when limitMph > limitKph', () => {
      vi.mocked(usePitSpeed).mockReturnValue({
        limitKph: 45,
        limitMph: 72,
        speedKph: 41.6,
        speedMph: 67,
        deltaKph: -3.1,
        deltaMph: -5.0,
        colorClass: 'text-green-500',
        isPulsing: false,
        isSpeeding: false,
        isSeverelyOver: false,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText(/-5\.0 mph/)).toBeInTheDocument();
      expect(getByText(/Limit: 72 mph/)).toBeInTheDocument();
    });

    it('shows green color when under speed limit', () => {
      vi.mocked(usePitSpeed).mockReturnValue({
        ...defaultSpeedResult,
        deltaKph: -5.0,
        colorClass: 'text-green-500',
        isSpeeding: false,
      });

      const { container } = render(<PitlaneHelper />);

      const speedElement = container.querySelector('.text-green-500');
      expect(speedElement).toBeInTheDocument();
    });

    it('shows red background when speeding', () => {
      vi.mocked(usePitSpeed).mockReturnValue({
        ...defaultSpeedResult,
        deltaKph: 1.0,
        isSpeeding: true,
        isSeverelyOver: false,
      });

      const { container } = render(<PitlaneHelper />);

      const speedContainer = container.querySelector('.bg-red-600\\/50');
      expect(speedContainer).toBeInTheDocument();
    });

    it('shows flashing red background when severely over limit', () => {
      vi.mocked(usePitSpeed).mockReturnValue({
        ...defaultSpeedResult,
        deltaKph: 4.2,
        isSpeeding: true,
        isSeverelyOver: true,
      });

      const { container } = render(<PitlaneHelper />);

      const speedContainer = container.querySelector(
        '.bg-red-600.animate-pulse'
      );
      expect(speedContainer).toBeInTheDocument();
    });
  });

  describe('Warnings', () => {
    it('shows pit limiter warning when enabled', () => {
      vi.mocked(usePitLimiterWarning).mockReturnValue({
        showWarning: true,
        warningText: '⚠ ACTIVATE LIMITER',
        isTeamRaceWarning: false,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('⚠ ACTIVATE LIMITER')).toBeInTheDocument();
    });

    it('shows disable limiter warning in auto-limiter series', () => {
      vi.mocked(usePitLimiterWarning).mockReturnValue({
        showWarning: true,
        warningText: '⚠ DISABLE LIMITER',
        isTeamRaceWarning: false,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('⚠ DISABLE LIMITER')).toBeInTheDocument();
    });

    it('shows team race warning with pulsing animation', () => {
      vi.mocked(usePitLimiterWarning).mockReturnValue({
        showWarning: true,
        warningText: '⚠ LIMITER! (TEAM RACE)',
        isTeamRaceWarning: true,
      });

      const { container, getByText } = render(<PitlaneHelper />);

      expect(getByText('⚠ LIMITER! (TEAM RACE)')).toBeInTheDocument();
      const warningElement = container.querySelector(
        '.bg-red-700.animate-pulse'
      );
      expect(warningElement).toBeInTheDocument();
    });

    it('shows early pitbox warning when on pit road and pitbox is close to entry', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 50,
        isEarlyPitbox: true,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('⚠ EARLY PITBOX')).toBeInTheDocument();
    });

    it('hides early pitbox warning when not on pit road', () => {
      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        isEarlyPitbox: true, // Even if flagged as early
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('⚠ EARLY PITBOX')).not.toBeInTheDocument();
    });

    it('hides early pitbox warning when disabled in config', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        enableEarlyPitboxWarning: false,
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        isEarlyPitbox: true,
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('⚠ EARLY PITBOX')).not.toBeInTheDocument();
    });
  });

  describe('Pit Exit Inputs', () => {
    it('shows pit exit inputs when enabled and on pit road', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitExitInputs: true,
        showInputsPhase: 'always',
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });

    it('hides pit exit inputs when not on pit road', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitExitInputs: true,
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return false;
        return undefined;
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('Pit Exit Inputs')).not.toBeInTheDocument();
    });

    it('shows inputs only at pitbox when phase is "atPitbox"', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitExitInputs: true,
        showInputsPhase: 'atPitbox',
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      // At pitbox (within 10m)
      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 5,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });

    it('hides inputs before pitbox when phase is "atPitbox"', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitExitInputs: true,
        showInputsPhase: 'atPitbox',
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      // Before pitbox (more than 10m away)
      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: 50,
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText('Pit Exit Inputs')).not.toBeInTheDocument();
    });

    it('shows inputs only after pitbox when phase is "afterPitbox"', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitExitInputs: true,
        showInputsPhase: 'afterPitbox',
      });

      vi.mocked(context.useTelemetryValue).mockImplementation((key) => {
        if (key === 'OnPitRoad') return true;
        return undefined;
      });

      // Past pitbox (negative distance, more than 10m)
      vi.mocked(usePitboxPosition).mockReturnValue({
        ...defaultPositionResult,
        distanceToPit: -25,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('Pit Exit Inputs')).toBeInTheDocument();
    });
  });

  describe('Traffic Display', () => {
    it('shows pitlane traffic when cars are present', () => {
      vi.mocked(usePitlaneTraffic).mockReturnValue({
        carsAhead: 2,
        carsBehind: 1,
        totalCars: 3,
      });

      const { getByText } = render(<PitlaneHelper />);

      expect(getByText('2 ahead • 1 behind')).toBeInTheDocument();
    });

    it('hides traffic when no cars in pitlane', () => {
      vi.mocked(usePitlaneTraffic).mockReturnValue({
        carsAhead: 0,
        carsBehind: 0,
        totalCars: 0,
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText(/ahead • behind/)).not.toBeInTheDocument();
    });

    it('hides traffic when disabled in config', () => {
      vi.mocked(usePitlaneHelperSettings).mockReturnValue({
        ...defaultConfig,
        showPitlaneTraffic: false,
      });

      vi.mocked(usePitlaneTraffic).mockReturnValue({
        carsAhead: 2,
        carsBehind: 1,
        totalCars: 3,
      });

      const { queryByText } = render(<PitlaneHelper />);

      expect(queryByText(/ahead • behind/)).not.toBeInTheDocument();
    });
  });
});
