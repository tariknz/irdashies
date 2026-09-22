import { describe, expect, it } from 'vitest';
import {
  LMU_DISCONNECT_GRACE_MS,
  shouldHoldLmuRunningState,
} from './runningState';

describe('LMU running state', () => {
  it('holds a live session through a transient unavailable frame', () => {
    expect(shouldHoldLmuRunningState(true, 1000, 3999)).toBe(true);
  });

  it('disconnects after the grace period or before a session starts', () => {
    expect(
      shouldHoldLmuRunningState(
        true,
        1000,
        1000 + LMU_DISCONNECT_GRACE_MS
      )
    ).toBe(false);
    expect(shouldHoldLmuRunningState(false, 1000, 1001)).toBe(false);
  });
});
