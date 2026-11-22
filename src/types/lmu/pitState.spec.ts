import { describe, expect, it } from 'vitest';
import { LMU_PIT_STATE, lmuPitRequested } from './pitState';

describe('lmuPitRequested', () => {
  it('is true only for the requested state', () => {
    expect(lmuPitRequested(LMU_PIT_STATE.requested)).toBe(true);
    expect(lmuPitRequested(LMU_PIT_STATE.none)).toBe(false);
    expect(lmuPitRequested(LMU_PIT_STATE.entering)).toBe(false);
    expect(lmuPitRequested(LMU_PIT_STATE.stopped)).toBe(false);
    expect(lmuPitRequested(LMU_PIT_STATE.exiting)).toBe(false);
    expect(lmuPitRequested(undefined)).toBe(false);
  });
});
