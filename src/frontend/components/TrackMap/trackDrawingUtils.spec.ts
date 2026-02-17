/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { drawDrivers } from './trackDrawingUtils';

describe('trackDrawingUtils', () => {
  let ctx: CanvasRenderingContext2D;

  beforeEach(() => {
    ctx = {
      beginPath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 4
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        false,
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
        2: 0        
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
        false,
        multiClassDriverLivePositions
      );

      const fillTextCalls = (ctx.fillText as any).mock.calls;
      // Should not display empty text when sessionPosition is undefined or 0
      expect(fillTextCalls.length).toBeLessThanOrEqual(0);
    });
  });
});
