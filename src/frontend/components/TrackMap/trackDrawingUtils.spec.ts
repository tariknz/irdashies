/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildSectorPath,
  drawDrivers,
  getSectorGapDimensions,
  getSectorPathRange,
  getTrackProgressLength,
} from './trackDrawingUtils';

describe('trackDrawingUtils', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 4,
      })),
      save: vi.fn(),
      restore: vi.fn(),
      textAlign: 'center',
      textBaseline: 'middle',
      fillStyle: 'white',
      strokeStyle: 'white',
      font: '16px sans-serif',
      lineWidth: 1,
      shadowColor: 'transparent',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
    } as any;
  });

  describe('drawDrivers', () => {
    const driverColors = {
      0: { fill: '#FF0000', text: 'white' },
      1: { fill: '#00FF00', text: 'white' },
      2: { fill: '#0000FF', text: 'white' },
    };

    const driversOffTrack = [false, false, false];

    const driverLivePositions = {
      0: 1,
      1: 2,
      2: 3,
    };

    const calculatePositions: Record<number, any> = {
      0: {
        driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any,
        position: { x: 100, y: 100 },
        isPlayer: true,
        progress: 0.5,
        sessionPosition: 0,
      },
      1: {
        driver: { CarIdx: 1, CarNumber: '2', CarClassID: 1 } as any,
        position: { x: 200, y: 100 },
        isPlayer: false,
        progress: 0.4,
        sessionPosition: 1,
      },
      2: {
        driver: { CarIdx: 2, CarNumber: '3', CarClassID: 2 } as any,
        position: { x: 150, y: 200 },
        isPlayer: false,
        progress: 0.3,
        sessionPosition: 0,
      },
    };

    it('should draw driver circles at correct positions', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      expect(ctx.arc).toHaveBeenCalledTimes(3);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('should display car numbers in carNumber mode', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      expect(ctx.fillText).toHaveBeenCalledWith('1', 100, expect.any(Number));
      expect(ctx.fillText).toHaveBeenCalledWith('2', 200, expect.any(Number));
      expect(ctx.fillText).toHaveBeenCalledWith('3', 150, expect.any(Number));
    });

    it('should display class positions in sessionPosition mode', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'sessionPosition',
        driverLivePositions
      );

      // Should render at least some positions
      expect(ctx.fillText).toHaveBeenCalled();
    });

    it('should not render text for undefined session positions', () => {
      const positionsWithUndefined: Record<number, any> = {
        ...calculatePositions,
        1: {
          ...calculatePositions[1],
          sessionPosition: undefined,
        },
      };

      drawDrivers(
        ctx,
        positionsWithUndefined,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'sessionPosition',
        driverLivePositions
      );

      // Should not render empty strings
      const calls = (ctx.fillText as any).mock.calls;
      expect(calls.some((c: any[]) => c[0] === '')).toBe(false);
    });

    it('should not render text when showCarNumbers is false', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        false,
        'carNumber',
        driverLivePositions
      );

      expect(ctx.fillText).not.toHaveBeenCalled();
    });

    it('should draw off-track yellow stroke', () => {
      const driversOffTrackArray = [true, false, false];

      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrackArray,
        40,
        40,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('should use correct circle sizes', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        30,
        50,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      const calls = (ctx.arc as any).mock.calls;
      // Should have calls with radius 30 (non-player) and 50 (player)
      expect(calls.some((c: any[]) => c[2] === 30)).toBe(true);
      expect(calls.some((c: any[]) => c[2] === 50)).toBe(true);
    });

    it('should draw player last (on top)', () => {
      drawDrivers(
        ctx,
        calculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      const calls = (ctx.arc as any).mock.calls;
      // Last call should be for the player
      expect(calls[calls.length - 1]).toEqual([100, 100, 40, 0, 2 * Math.PI]);
    });

    it('should display session position when displayMode is sessionPosition with multi-class drivers', () => {
      const multiClassCalculatePositions: Record<number, any> = {
        0: {
          driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any,
          position: { x: 100, y: 100 },
          isPlayer: true,
          progress: 0.5,
          sessionPosition: 1,
        },
        1: {
          driver: { CarIdx: 1, CarNumber: '2', CarClassID: 2 } as any,
          position: { x: 200, y: 100 },
          isPlayer: false,
          progress: 0.4,
          sessionPosition: 2,
        },
        2: {
          driver: { CarIdx: 2, CarNumber: '3', CarClassID: 1 } as any,
          position: { x: 150, y: 100 },
          isPlayer: false,
          progress: 0.6,
          sessionPosition: 3,
        },
      };

      drawDrivers(
        ctx,
        multiClassCalculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'sessionPosition',
        driverLivePositions
      );

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      // Should display session positions, not car numbers
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['1'])); // Position 1
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['2'])); // Position 2
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['3'])); // Position 3
    });

    it('should display car numbers when displayMode is carNumber with multi-class drivers', () => {
      const multiClassCalculatePositions: Record<number, any> = {
        0: {
          driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any,
          position: { x: 100, y: 100 },
          isPlayer: true,
          progress: 0.5,
          sessionPosition: 1,
        },
        1: {
          driver: { CarIdx: 1, CarNumber: '2', CarClassID: 2 } as any,
          position: { x: 200, y: 100 },
          isPlayer: false,
          progress: 0.4,
          sessionPosition: 2,
        },
        2: {
          driver: { CarIdx: 2, CarNumber: '3', CarClassID: 1 } as any,
          position: { x: 150, y: 100 },
          isPlayer: false,
          progress: 0.6,
          sessionPosition: 3,
        },
      };

      drawDrivers(
        ctx,
        multiClassCalculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'carNumber',
        driverLivePositions
      );

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      // Should display car numbers, not positions
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['1'])); // Car Number 1
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['2'])); // Car Number 2
      expect(fillTextCalls).toContainEqual(expect.arrayContaining(['3'])); // Car Number 3
    });

    it('should handle missing sessionPosition gracefully in multi-class scenarios', () => {
      const multiClassCalculatePositions: Record<number, any> = {
        0: {
          driver: { CarIdx: 0, CarNumber: '1', CarClassID: 1 } as any,
          position: { x: 100, y: 100 },
          isPlayer: true,
          progress: 0.5,
          sessionPosition: undefined,
        },
        1: {
          driver: { CarIdx: 1, CarNumber: '2', CarClassID: 2 } as any,
          position: { x: 200, y: 100 },
          isPlayer: false,
          progress: 0.4,
          sessionPosition: 0,
        },
      };

      const multiClassDriverLivePositions = {
        1: 0,
        2: 0,
      };

      drawDrivers(
        ctx,
        multiClassCalculatePositions,
        driverColors,
        driversOffTrack,
        40,
        40,
        100,
        true,
        'sessionPosition',
        multiClassDriverLivePositions
      );

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      // Should not display empty text when sessionPosition is undefined or 0
      expect(fillTextCalls.length).toBeLessThanOrEqual(0);
    });
  });

  describe('getTrackProgressLength', () => {
    it('maps progress forward from start finish for anticlockwise tracks', () => {
      expect(getTrackProgressLength(0.25, 1000, 400, 'anticlockwise')).toBe(
        650
      );
    });

    it('maps progress backward from start finish for clockwise tracks', () => {
      expect(getTrackProgressLength(0.25, 1000, 400, 'clockwise')).toBe(150);
    });

    it('wraps clockwise progress when subtracting would go below zero', () => {
      expect(getTrackProgressLength(0.75, 1000, 400, 'clockwise')).toBe(650);
    });
  });

  describe('getSectorPathRange', () => {
    it('uses the direct forward range for anticlockwise sectors', () => {
      expect(getSectorPathRange(0.1, 0.3, 1000, 400, 'anticlockwise')).toEqual({
        startLength: 500,
        endLength: 700,
        needsWrap: false,
      });
    });

    it('uses the complementary forward range for clockwise sectors', () => {
      expect(getSectorPathRange(0.1, 0.3, 1000, 400, 'clockwise')).toEqual({
        startLength: 100,
        endLength: 300,
        needsWrap: false,
      });
    });

    it('wraps clockwise sectors when the complementary range crosses zero', () => {
      expect(getSectorPathRange(0.25, 0.5, 1000, 400, 'clockwise')).toEqual({
        startLength: 900,
        endLength: 150,
        needsWrap: true,
      });
    });
  });

  describe('buildSectorPath', () => {
    it('starts a new subpath when a wrapped sector jumps from head to tail', () => {
      const points = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 30, y: 0 },
        { x: 40, y: 0 },
      ];
      const lengths = [0, 10, 20, 30, 40];

      buildSectorPath(ctx, points, lengths, 28, 8, true);

      expect(ctx.moveTo).toHaveBeenNthCalledWith(1, 28, 0);
      expect(ctx.moveTo).toHaveBeenNthCalledWith(2, 0, 0);
    });
  });

  describe('getSectorGapDimensions', () => {
    it('uses a small erase thickness while still spanning the track width', () => {
      expect(getSectorGapDimensions(20, 40)).toEqual({
        gapLength: 44,
        gapThickness: 8,
      });
    });
  });
});
