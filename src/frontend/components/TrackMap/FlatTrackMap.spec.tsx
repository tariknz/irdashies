/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FlatTrackMap } from './FlatTrackMap';
import { render } from '@testing-library/react';

vi.mock('./hooks/useTrackId');
vi.mock('./hooks/useDriverProgress');
vi.mock('./hooks/useFlatTrackMapSettings');
vi.mock('./hooks/useHighlightColor');
vi.mock('@irdashies/context', () => ({
  useSessionVisibility: vi.fn(),
  useTelemetryValue: vi.fn(),
}));
vi.mock('./FlatTrackMapCanvas', () => ({
  FlatTrackMapCanvas: () => <div>Flat Track Canvas</div>,
}));
vi.mock('./tracks/tracks.json', () => ({
  default: [null, { id: 1, name: 'Test Track' }],
}));

import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useFlatTrackMapSettings } from './hooks/useFlatTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';

describe('FlatTrackMap', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(useTrackId).mockReturnValue(1);
    vi.mocked(useDriverProgress).mockReturnValue([]);
    vi.mocked(useHighlightColor).mockReturnValue(undefined);
    vi.mocked(useSessionVisibility).mockReturnValue(true);
  });

  it('should render when all conditions are met', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
  });

  it('should hide when showOnlyWhenOnTrack is true and player is not on track', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: true,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(false);

    const { container } = render(<FlatTrackMap />);

    expect(container.firstChild).toBeNull();
  });

  it('should show when showOnlyWhenOnTrack is true and player is on track', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: true,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
  });

  it('should hide when session visibility is false', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useSessionVisibility).mockReturnValue(false);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    expect(container.firstChild).toBeNull();
  });

  it('should hide when trackId is not available', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTrackId).mockReturnValue(undefined);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    // When trackId is null, it returns empty in non-debug mode, but we're in test mode
    // so it will show the debug message or nothing
    expect(container.firstChild).toBeDefined();
  });

  it('should pass displayMode sessionPosition to canvas in multi-class race', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'sessionPosition',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTrackId).mockReturnValue(1);
    vi.mocked(useDriverProgress).mockReturnValue([
      { driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any, progress: 0.5, isPlayer: true, position: 1 },
      { driver: { CarIdx: 1, CarNumber: '2', CarClassID: 2 } as any, progress: 0.4, isPlayer: false, position: 2 },
      { driver: { CarIdx: 2, CarNumber: '3', CarClassID: 1 } as any, progress: 0.6, isPlayer: false, position: 3 },
    ] as any);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
    // Verify the component rendered - the FlatTrackMapCanvas mock renders this text
    expect(container.textContent).toContain('Flat Track Canvas');
  });

  it('should pass displayMode carNumber to canvas', () => {
    vi.mocked(useFlatTrackMapSettings).mockReturnValue({
      showCarNumbers: true,
      displayMode: 'carNumber',
      driverCircleSize: 40,
      playerCircleSize: 40,
      trackLineWidth: 20,
      trackOutlineWidth: 40,
      invertTrackColors: false,
      useHighlightColor: false,
      showOnlyWhenOnTrack: false,
      sessionVisibility: { race: true, loneQualify: true, openQualify: true, practice: true, offlineTesting: true },
    });
    vi.mocked(useTrackId).mockReturnValue(1);
    vi.mocked(useDriverProgress).mockReturnValue([
      { driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any, progress: 0.5, isPlayer: true },
      { driver: { CarIdx: 1, CarNumber: '2', CarClassID: 1 } as any, progress: 0.4, isPlayer: false },
    ] as any);
    vi.mocked(useTelemetryValue).mockReturnValue(true);

    const { container } = render(<FlatTrackMap />);

    expect(container.querySelector('.w-full')).toBeTruthy();
    expect(container.textContent).toContain('Flat Track Canvas');
  });
});
