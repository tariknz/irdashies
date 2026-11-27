import { describe, expect, it } from 'vitest';
import {
  alignOpponentPosition,
  createPositionHistory,
  type AlignedPosition,
} from './positionAlignment';

const align = (
  history: ReturnType<typeof createPositionHistory>,
  carTime: number,
  z: number,
  playerTime: number
): AlignedPosition => {
  const out = { x: 0, z: 0 };
  alignOpponentPosition(history, 0, 0, z, carTime, playerTime, out);
  return out;
};

describe('alignOpponentPosition', () => {
  it('moves a car forward to the player clock from its last two samples', () => {
    const history = createPositionHistory();
    align(history, 1, 50, 1);
    expect(align(history, 1.1, 57, 1.2).z).toBeCloseTo(64);
  });

  it('keeps aligning a repeated identical frame', () => {
    const history = createPositionHistory();
    align(history, 1, 50, 1);
    align(history, 1.1, 57, 1.1);
    expect(align(history, 1.1, 57, 1.2).z).toBeCloseTo(64);
  });

  it('measures the next step from a position that moved without the clock', () => {
    const history = createPositionHistory();
    align(history, 1, 50, 1);
    align(history, 1.1, 57, 1.1);
    expect(align(history, 1.1, 64, 1.2).z).toBeCloseTo(71);
    expect(align(history, 1.2, 71, 1.3).z).toBeCloseTo(78);
  });
});
