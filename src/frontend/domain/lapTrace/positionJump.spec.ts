import { describe, it, expect } from 'vitest';
import {
  JUMP_BACK_M,
  JUMP_FORWARD_M,
  detectPositionJump,
} from './positionJump';

/** A 5 km road course, sampled at 60 Hz. */
const L = 5000;
const FRAME = 1 / 60;

const at = (
  prevM: number,
  m: number,
  dt = FRAME,
  trackLengthM = L
): ReturnType<typeof detectPositionJump> =>
  detectPositionJump(prevM, m, 0, dt, trackLengthM);

describe('detectPositionJump', () => {
  it('reads ordinary driving as continuous', () => {
    // 90 m/s is 1.5 m per frame.
    expect(at(2000, 2001.5)).toBe('none');
    expect(at(0, 0)).toBe('none');
  });

  it('does not flag the start/finish crossing', () => {
    expect(at(L - 10, 10)).toBe('none');
    // Nor the frame either side of it.
    expect(at(L - 1.5, L - 0.01)).toBe('none');
    expect(at(0.01, 1.5)).toBe('none');
  });

  it('flags an active reset back to an earlier corner', () => {
    expect(at(3200, 2700)).toBe('backward');
  });

  it('flags a reset that lands more than half a lap back', () => {
    // 3000 -> 200 is 2800 m back; read forwards it is 2200 m, still far past
    // anything a car covers in a frame, so it is caught either way.
    expect(at(3000, 200)).toBe('forward');
  });

  it('tolerates a spin or a car dithering backwards on the spot', () => {
    expect(at(2000, 1999.9)).toBe('none');
    expect(at(2000, 2000 - (JUMP_BACK_M - 1))).toBe('none');
  });

  it('tolerates a car reversing back down the track', () => {
    // 10 m/s in reverse is 0.17 m per frame, so no single frame ever looks
    // like a jump however far the car eventually backs up.
    let m = 2000;
    for (let i = 0; i < 600; i++) {
      const next = m - 10 * FRAME;
      expect(at(m, next)).toBe('none');
      m = next;
    }
    expect(m).toBeLessThan(1900);
  });

  it('does not mistake a stalled telemetry delivery for a teleport', () => {
    // One second of frames lost at 90 m/s: a 90 m hole, but drivable.
    expect(at(2000, 2090, 1)).toBe('none');
  });

  it('flags ground covered faster than any car could', () => {
    // The same 90 m hole, but in a single frame.
    expect(at(2000, 2090)).toBe('forward');
  });

  it('flags SessionTime going backwards, however small the move', () => {
    expect(detectPositionJump(2000, 2000.5, 10, 9.5, L)).toBe('timeRewind');
  });

  it('stays quiet on a short track where a big forward move wraps', () => {
    // On a 400 m oval, 250 m forwards reads as 150 m backwards. It is
    // plausible forwards at 25 m/s over 10 s, so it is not a jump.
    expect(at(50, 300, 10, 400)).toBe('none');
  });

  it('returns none for unusable inputs', () => {
    expect(at(2000, 2700, FRAME, 0)).toBe('none');
    expect(at(Number.NaN, 2700)).toBe('none');
    expect(at(2000, Number.NaN)).toBe('none');
    expect(detectPositionJump(2000, 2700, Number.NaN, 1, L)).toBe('none');
  });

  it('holds its thresholds at the documented sizes', () => {
    expect(JUMP_BACK_M).toBe(25);
    expect(JUMP_FORWARD_M).toBe(50);
  });
});
